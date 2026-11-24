import { FileUp, Shuffle, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "~/shell/media";
import { ControlGroup } from "~/shell/tool/ControlGroup";
import { useStoresHydrated } from "~/shell/tool/persist";
import { ToolShell } from "~/shell/tool/ToolShell";
import { Button } from "~/ui/button";
import { cn } from "~/ui/lib/utils";
import { Slider } from "~/ui/slider";
import { toast } from "~/ui/sonner";
import { Switch } from "~/ui/switch";
import { Tag } from "~/ui/tag";
import { TextField } from "~/ui/text-field";
import { Textarea } from "~/ui/textarea";
import { canStart, namesFromFile, nextRollingName, parseNames, pickOne, remainingPool } from "./logic/names";
import { generateNumbers, validateRange, type RangeErrors } from "./logic/numbers";
import meta from "./meta";
import { DEFAULT_SETTINGS, persistedStores, SAMPLE_NAMES, useSession, useSettings } from "./store";

const FILE_LIMIT = 2 * 1024 * 1024;

function NumberGenerator({ onGenerate }: { onGenerate: (names: string[]) => void }) {
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("50");
  const [padZero, setPadZero] = useState(true);
  const [errors, setErrors] = useState<RangeErrors>({});

  function generate() {
    const range = { start: Number(start), end: Number(end), step: 1, padZero };
    const found = validateRange(range);
    setErrors(found);
    if (Object.keys(found).length) return;
    onGenerate(generateNumbers(range));
  }

  return (
    <ControlGroup title="生成号码">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="起始" inputMode="numeric" value={start} onChange={setStart} error={errors.start} />
        <TextField label="结束" inputMode="numeric" value={end} onChange={setEnd} error={errors.end} />
      </div>
      <Switch label="按位数补零" checked={padZero} onCheckedChange={setPadZero} />
      <Button size="sm" className="justify-self-start" onClick={generate}>
        用号码替换名单
      </Button>
    </ControlGroup>
  );
}

export default function RandomPicker() {
  const ready = useStoresHydrated(persistedStores);
  const mobile = useIsMobile();
  const { noRepeat, intervalMs, fontScale } = useSettings();
  const { namesText, picked } = useSession();
  const [rolling, setRolling] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const file = useRef<HTMLInputElement>(null);

  const names = useMemo(() => parseNames(namesText), [namesText]);
  const pool = useMemo(() => remainingPool(names, picked, noRepeat), [names, picked, noRepeat]);
  const running = rolling !== null;
  // 滚动的定时器每一帧读最新的池子：滚动途中改了名单或规则也不会抽到已经不该抽的人
  const poolRef = useRef(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => () => clearInterval(timer.current), []);

  function setPicked(next: string[]) {
    useSession.setState({ picked: next });
  }

  function start() {
    const check = canStart(names, pool);
    if (!check.ok) {
      if (check.reason === "empty") toast.warning("名单还是空的，先填几个名字");
      else toast.warning("名单里的人都抽过了", { action: { label: "重新开始", onClick: () => setPicked([]) } });
      return;
    }
    let shown = nextRollingName(pool, undefined);
    setRolling(shown ?? "");
    timer.current = setInterval(() => {
      shown = nextRollingName(poolRef.current, shown);
      setRolling(shown ?? "");
    }, intervalMs);
  }

  function stop() {
    clearInterval(timer.current);
    setRolling(null);
    const winner = pickOne(poolRef.current);
    if (winner === undefined) return;
    setPicked([...useSession.getState().picked, winner]);
    setRevealKey((k) => k + 1);
  }

  // 换名单会清掉抽取记录；轻提示里给一次撤销，所以不用先弹确认
  function replaceNames(next: string[], message: string) {
    const previous = useSession.getState();
    useSession.setState({ namesText: next.join("\n"), picked: [] });
    toast.success(message, {
      action: { label: "撤销", onClick: () => useSession.setState({ namesText: previous.namesText, picked: previous.picked }) },
    });
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    if (f.size > FILE_LIMIT) {
      toast.error("这个文件超过 2MB，名单一般用不了这么大，换一个试试");
      return;
    }
    const list = namesFromFile(await f.text(), f.name);
    if (!list.length) {
      toast.error("文件里没有读到名字，要一行一个");
      return;
    }
    replaceNames(list, `已导入 ${list.length} 人`);
  }

  const last = picked.length - 1;
  const display = rolling ?? picked[last] ?? (names.length ? "准备好了" : "还没有名单");
  // 字号按名单里最长的名字算，滚动时不会忽大忽小；跟着舞台大小走，全屏时自动变大
  const longest = Math.min(12, Math.max(4, ...names.map((n) => n.length)));
  const fontSize = `calc(min(${(64 / longest).toFixed(2)}cqw, 18cqh) * ${fontScale / 100})`;
  const sample = namesText === SAMPLE_NAMES;

  const stage = (
    <div className="grid size-full content-center justify-items-center gap-6 text-center [container-type:size]">
      <div
        key={running ? "rolling" : revealKey}
        aria-live={running ? "off" : "polite"}
        style={{ fontSize }}
        className={cn(
          "leading-[1.05] font-extrabold tracking-[0.04em] break-words",
          running ? "text-ink-muted" : "text-ink",
          !running && revealKey > 0 && "animate-mist-in",
        )}
      >
        {display}
      </div>
      <div aria-label="已抽到" className="flex min-h-[22px] max-w-[560px] flex-wrap justify-center gap-2">
        {picked.map((n, i) => (
          <Tag key={`${i}-${n}`} tone={i === last ? "sky" : "neutral"}>
            {n}
          </Tag>
        ))}
      </div>
    </div>
  );

  const canClearPicked = picked.length > 0 && !running;
  const clearPicked = (
    <Button variant="ghost" size={mobile ? "sm" : "md"} onClick={() => setPicked([])}>
      清空记录
    </Button>
  );

  // 手机底栏只放主按钮，让它占满整行；“清空记录”挪进抽屉
  const controls = (
    <>
      {mobile && canClearPicked ? (
        <ControlGroup title="抽取记录">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ui text-ink">已抽 {picked.length} 人</span>
            {clearPicked}
          </div>
        </ControlGroup>
      ) : null}
      <ControlGroup title="名单">
        <div className="grid gap-2">
          <label htmlFor="picker-names" className="text-ui text-ink">
            每行一个名字
          </label>
          <Textarea id="picker-names" value={namesText} onChange={(e) => useSession.setState({ namesText: e.target.value })} spellCheck={false} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => file.current?.click()}>
            <FileUp aria-hidden />
            从文件导入
          </Button>
          <input
            ref={file}
            type="file"
            hidden
            accept=".txt,.csv,text/plain,text/csv"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {namesText ? (
            <Button size="sm" variant="ghost" onClick={() => replaceNames([], "已清空名单")}>
              清空名单
            </Button>
          ) : null}
        </div>
      </ControlGroup>
      <ControlGroup title="规则">
        <Switch label="抽过的人不再抽到" checked={noRepeat} onCheckedChange={(v) => useSettings.setState({ noRepeat: v })} />
        <Slider
          label="滚动间隔"
          min={30}
          max={150}
          step={10}
          unit=" ms"
          value={intervalMs}
          onValueChange={(v) => useSettings.setState({ intervalMs: v })}
        />
        <Slider label="文字大小" min={50} max={200} step={10} unit="%" value={fontScale} onValueChange={(v) => useSettings.setState({ fontScale: v })} />
      </ControlGroup>
      <NumberGenerator onGenerate={(list) => replaceNames(list, `已生成 ${list.length} 个号码`)} />
    </>
  );

  return (
    <ToolShell
      tool={meta}
      ready={ready}
      immersive
      controls={controls}
      summary={`名单 ${names.length} 人 · 已抽 ${picked.length} 人`}
      stage={stage}
      status={
        <>
          {sample ? <Tag>示例名单</Tag> : null}
          <span>{names.length} 人</span>
          <span>已抽 {picked.length} 人</span>
        </>
      }
      actions={!mobile && canClearPicked ? clearPicked : null}
      primary={{
        label: running ? "停下" : "开始抽取",
        icon: running ? Square : Shuffle,
        hotkey: "space",
        onClick: running ? stop : start,
      }}
      onReset={() => {
        clearInterval(timer.current);
        setRolling(null);
        // 只恢复设置；名单是用户的数据，不跟着清掉
        useSettings.setState({ ...DEFAULT_SETTINGS });
        toast("已恢复默认");
      }}
    />
  );
}
