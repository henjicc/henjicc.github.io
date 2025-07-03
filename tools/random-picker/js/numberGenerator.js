class NumberGenerator {
    constructor() {
        this.defaults = {
            start: 1,
            end: 50,
            step: 1,
            padZero: true
        };
        this.modal = document.getElementById('numberGeneratorModal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 生成按钮的事件监听
        document.getElementById('generateNumbers').addEventListener('click', () => {
            this.showGeneratorModal();
        });

        // 关闭按钮事件
        this.modal.querySelector('.close').addEventListener('click', () => {
            this.hideGeneratorModal();
        });

        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideGeneratorModal();
            }
        });

        // 确认生成按钮事件
        document.getElementById('confirmGenerate').addEventListener('click', () => {
            this.handleGenerate();
        });

        // 实时预览
        const inputs = ['startNumber', 'endNumber', 'stepNumber', 'padZero'];
        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updatePreview();
            });
        });
    }

    showGeneratorModal() {
        this.modal.style.display = 'flex';
        setTimeout(() => this.modal.classList.add('show'), 10);
        this.updatePreview(); // 初始预览
    }

    hideGeneratorModal() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
    }

    updatePreview() {
        const values = this.getInputValues();
        if (!this.validateInputs(values)) return;

        const preview = this.generatePreview(
            values.start,
            values.end,
            values.step,
            values.padZero
        );
        document.getElementById('numberPreview').textContent = preview;
    }

    getInputValues() {
        return {
            start: parseInt(document.getElementById('startNumber').value),
            end: parseInt(document.getElementById('endNumber').value),
            step: parseInt(document.getElementById('stepNumber').value),
            padZero: document.getElementById('padZero').checked
        };
    }

    validateInputs(values) {
        // 清除所有错误
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });

        let isValid = true;

        // 验证起始值
        if (isNaN(values.start)) {
            this.showError('startNumber', '请输入有效的起始值');
            isValid = false;
        }

        // 验证结束值
        if (isNaN(values.end) || values.end <= values.start) {
            this.showError('endNumber', '结束值必须大于起始值');
            isValid = false;
        }

        // 验证步长
        if (isNaN(values.step) || values.step <= 0) {
            this.showError('stepNumber', '步长必须大于0');
            isValid = false;
        }

        // 验证步长是否合适
        if (values.step > (values.end - values.start)) {
            this.showError('stepNumber', '步长过大');
            isValid = false;
        }

        return isValid;
    }

    showError(inputId, message) {
        const group = document.getElementById(inputId).closest('.form-group');
        group.classList.add('error');
        const errorDiv = group.querySelector('.error-message') || this.createErrorElement(group);
        errorDiv.textContent = message;
    }

    createErrorElement(group) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        group.appendChild(errorDiv);
        return errorDiv;
    }

    generatePreview(start, end, step, padZero) {
        const numbers = this.generateNumbers(start, end, step, padZero);
        if (numbers.length <= 6) {
            return numbers.join(', ');
        }
        return `${numbers.slice(0, 3).join(', ')} ... ${numbers[numbers.length - 1]}`;
    }

    generateNumbers(start, end, step, padZero) {
        const numbers = [];
        const padLength = padZero ? this.getPadLength(end) : 0;

        for (let i = start; i <= end; i += step) {
            let num = i.toString();
            if (padZero) {
                num = num.padStart(padLength, '0');
            }
            numbers.push(num);
        }
        return numbers;
    }

    getPadLength(end) {
        return end.toString().length;
    }

    handleGenerate() {
        const values = this.getInputValues();
        if (!this.validateInputs(values)) return;

        const numbers = this.generateNumbers(
            values.start,
            values.end,
            values.step,
            values.padZero
        );

        // 将生成的数字填入导入文本框
        document.getElementById('namesInput').value = numbers.join('\n');
        this.hideGeneratorModal();
    }
}

// 初始化数字生成器
document.addEventListener('DOMContentLoaded', () => {
    window.numberGenerator = new NumberGenerator();
}); 