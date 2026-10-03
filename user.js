(() => {
    'use strict';

    // =================================================================
    // CONFIGURAÇÃO
    // =================================================================
    const CONFIG = {
        name: 'DeepHat Bool',
        icon: '⚡',
        ui: {
            primary: '#00d2ff',
            success: '#2ecc71',
            error: '#e74c3c',
            bg: '#050510',
            font: "'Inter', sans-serif"
        },
        debug: false,
        cachePrefix: 'dh_bool_'
    };

    const log = (...args) => CONFIG.debug && console.log(`[${CONFIG.name}]:`, ...args);

    // =================================================================
    // UI (VISUAL)
    // =================================================================
    const UI = {
        injectStyles() {
            const style = document.createElement('style');
            style.innerHTML = `
                :root {
                    --dh-primary: ${CONFIG.ui.primary};
                    --dh-success: ${CONFIG.ui.success};
                    --dh-error: ${CONFIG.ui.error};
                    --dh-bg: ${CONFIG.ui.bg};
                    --dh-font: ${CONFIG.ui.font};
                }
                #dh_toasts {
                    position: fixed; top: 20px; right: 20px; z-index: 999999;
                    display: flex; flex-direction: column; gap: 10px;
                    font-family: var(--dh-font);
                }
                .dh-toast {
                    background: rgba(10, 10, 20, 0.95);
                    backdrop-filter: blur(10px);
                    color: #fff;
                    padding: 12px 16px;
                    border-radius: 8px;
                    border-left: 4px solid var(--dh-primary);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    min-width: 250px;
                    font-size: 13px;
                    transform: translateX(120%);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .dh-toast.show { transform: translateX(0); }
                .dh-toast.success { border-left-color: var(--dh-success); }
                .dh-toast.error { border-left-color: var(--dh-error); }

                .dh-bool-container {
                    margin: 20px 0; padding: 20px;
                    background: linear-gradient(135deg, rgba(0, 210, 255, 0.1), rgba(5, 5, 16, 0.2));
                    border: 1px solid var(--dh-primary);
                    border-radius: 12px;
                    font-family: var(--dh-font);
                    color: #fff;
                }
                .dh-bool-header {
                    display: flex; align-items: center; gap: 10px;
                    font-weight: bold; font-size: 16px; margin-bottom: 15px;
                    border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;
                }
                .dh-bool-badge {
                    background: var(--dh-primary); color: black;
                    padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 900;
                }
                .dh-bool-option {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 12px; margin-bottom: 10px;
                    background: rgba(0,0,0,0.3); border-radius: 8px;
                    border: 1px solid transparent; transition: all 0.2s;
                }
                .dh-bool-option.correct { border-color: var(--dh-success); background: rgba(46, 204, 113, 0.1); }
                .dh-bool-option.incorrect { border-color: var(--dh-error); background: rgba(231, 76, 49, 0.1); }
                
                .dh-bool-text { font-size: 14px; line-height: 1.5; }
                .dh-bool-status { font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
                .dh-bool-status.correct { background: var(--dh-success); color: black; }
                .dh-bool-status.incorrect { background: var(--dh-error); color: white; }

                .dh-bool-input {
                    width: 100%; padding: 12px; margin-top: 10px;
                    background: rgba(0,0,0,0.3); border: 1px solid var(--dh-primary);
                    border-radius: 8px; color: white; font-size: 16px; font-family: var(--dh-font);
                }
                .dh-bool-hint {
                    font-size: 12px; color: #aaa; margin-top: 5px; font-style: italic;
                }
            `;
            document.head.appendChild(style);
        },

        toast(msg, type = 'info', duration = 4000) {
            const container = document.getElementById('dh_toasts') || (() => {
                const c = document.createElement('div');
                c.id = 'dh_toasts';
                document.body.appendChild(c);
                return c;
            })();
            
            const toast = document.createElement('div');
            toast.className = `dh-toast ${type}`;
            toast.innerHTML = `<div>${msg}</div>`;
            container.appendChild(toast);
            
            requestAnimationFrame(() => toast.classList.add('show'));
            if (duration > 0) {
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }
        }
    };

    // =================================================================
    // O "CÉREBRO" (EXTRAÇÃO DE RESPOSTAS)
    // =================================================================
    const Brain = {
        /**
         * Extrai a resposta correta do itemDataAnswerless
         */
        extractCorrectAnswer(itemDataAnswerless) {
            if (!itemDataAnswerless) return null;
            
            let itemData;
            try {
                itemData = typeof itemDataAnswerless === 'string' ? JSON.parse(itemDataAnswerless) : itemDataAnswerless;
            } catch (e) {
                return null;
            }

            const widgets = itemData.question?.widgets || {};
            let correctAnswer = null;
            let answerType = null;
            let choices = [];

            for (const [widgetId, widget] of Object.entries(widgets)) {
                const type = widget.type;
                
                // MÚLTIPLA ESCOLHA (RADIO)
                if (type === 'radio') {
                    const opts = widget.options?.choices || [];
                    const correct = opts.find(o => o.correct === true);
                    if (correct) {
                        correctAnswer = correct.id;
                        answerType = 'radio';
                        choices = opts.map(o => ({ id: o.id, text: o.content.replace(/<[^>]*>?/g, '').trim() }));
                        break;
                    }
                }
                
                // MÚLTIPLA ESCOLHA MÚLTIPLA (MULTI)
                else if (type === 'multi') {
                    const opts = widget.options?.choices || [];
                    const corrects = opts.filter(o => o.correct === true);
                    if (corrects.length > 0) {
                        correctAnswer = corrects.map(c => c.id);
                        answerType = 'multi';
                        choices = opts.map(o => ({ id: o.id, text: o.content.replace(/<[^>]*>?/g, '').trim() }));
                        break;
                    }
                }
                
                // INPUT (TEXTO/NÚMERO)
                else if (type === 'input') {
                    const correctVal = widget.options?.correct;
                    if (correctVal !== undefined && correctVal !== null) {
                        correctAnswer = String(correctVal);
                        answerType = 'input';
                        break;
                    }
                }
            }

            return { correctAnswer, answerType, choices, widgetId: Object.keys(widgets)[0] };
        },

        /**
         * Resolve matemática simples
         */
        solveMath(mathString) {
            if (!mathString || typeof mathString !== 'string') return null;
            let clean = mathString
                .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
                .replace(/\\pi/g, 'Math.PI')
                .replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)')
                .replace(/\\times/g, '*')
                .replace(/\\div/g, '/')
                .replace(/\\cdot/g, '*');
            if (!/^[0-9+\-*/().\sMathPI\s]+$/.test(clean)) return null;
            try {
                const res = new Function(`return (${clean})`)();
                return isFinite(res) ? Math.round(res * 10000) / 10000 : null;
            } catch (e) { return null; }
        }
    };

    // =================================================================
    // INTERCEPTOR DE REDE
    // =================================================================
    const NetworkInterceptor = {
        originalFetch: null,
        
        init() {
            this.originalFetch = window.fetch;
            window.fetch = this.patchedFetch.bind(this);
            UI.injectStyles();
            UI.toast('DeepHat Bool Ativo ⚡', 'success');
        },

        patchedFetch(input, init) {
            const url = input instanceof Request ? input.url : input;
            if (!url.includes('khanacademy.org') || !url.includes('getAssessment')) {
                return this.originalFetch(input, init);
            }

            const response = this.originalFetch(input, init);
            const clone = response.clone();
            
            clone.json().then(data => {
                const item = data?.data?.assessmentItemById?.item || data?.data?.assessmentItemByProblemNumber?.item;
                if (item?.id && item?.itemDataAnswerless) {
                    this.transformItem(item, data, response);
                }
            }).catch(e => log('Erro ao ler JSON', e));
            
            return response;
        },

        transformItem(item, data, response) {
            const cacheKey = `${item.id}-${item.sha}`;
            
            // Verifica cache local
            const cached = this.getLocalCache(cacheKey);
            if (cached) {
                this.injectWidget(item, cached, data, response);
                return;
            }

            // Extrai resposta
            const extracted = Brain.extractCorrectAnswer(item.itemDataAnswerless);
            
            // Fallback para matemática
            if (!extracted?.correctAnswer && item.itemDataAnswerless) {
                let itemData = JSON.parse(item.itemDataAnswerless);
                const math = itemData.question?.math;
                if (math) {
                    const sol = Brain.solveMath(math);
                    if (sol !== null) {
                        extracted = { correctAnswer: String(sol), answerType: 'input', widgetId: Object.keys(itemData.question.widgets)[0] };
                    }
                }
            }

            if (extracted?.correctAnswer) {
                this.setLocalCache(cacheKey, extracted);
                this.injectWidget(item, extracted, data, response);
            }
        },

        injectWidget(item, answer, data, response) {
            let itemData = JSON.parse(item.itemDataAnswerless);
            const widgetId = answer.widgetId || Object.keys(itemData.question.widgets)[0];
            
            // Remove widgets antigos
            itemData.question.widgets = {};
            itemData.hints = [];
            
            // Gera novo widget de "Verdadeiro ou Falso"
            let newWidget;
            let content = `**Modo Bool: Identifique a Resposta Correta**\n\n`;

            if (answer.answerType === 'radio' || answer.answerType === 'multi') {
                // Cria um radio com as opções, marcando a correta como "correct: true"
                // O aluno verá as opções, mas a UI será substituída pelo nosso visual
                itemData.question.widgets[widgetId] = {
                    type: 'radio',
                    alignment: 'default',
                    static: false,
                    graded: true,
                    options: {
                        choices: answer.choices.map(c => ({
                            content: c.text,
                            correct: c.id === answer.correctAnswer,
                            id: c.id
                        })),
                        randomize: false,
                        multipleSelect: false,
                        deselectEnabled: false
                    },
                    version: { major: 1, minor: 0 }
                };
            } else if (answer.answerType === 'input') {
                itemData.question.widgets[widgetId] = {
                    type: 'input',
                    alignment: 'default',
                    static: false,
                    graded: true,
                    options: {
                        correct: answer.correctAnswer,
                        passable: false
                    },
                    version: { major: 1, minor: 0 }
                };
            }

            item.itemDataAnswerless = JSON.stringify(itemData);
            
            // Reescreve a resposta do fetch
            const newResponse = new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
            
            // Auto-Clicker
            if (CONFIG.autoClick) {
                this.startAutoClicker(widgetId, answer.correctAnswer, answer.answerType);
            }
            
            return newResponse;
        },

        startAutoClicker(widgetId, correctAnswer, answerType) {
            const observer = new MutationObserver(() => {
                // Espera o widget renderizar
                const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
                if (!widget) return;

                if (answerType === 'radio' || answerType === 'multi') {
                    const input = widget.querySelector(`input[value="${correctAnswer}"]`);
                    if (input && !input.checked) {
                        input.click();
                    }
                } else if (answerType === 'input') {
                    const input = widget.querySelector('input[type="text"], textarea');
                    if (input && input.value !== correctAnswer) {
                        input.value = correctAnswer;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }

                // Clica em verificar
                setTimeout(() => {
                    const checkBtn = document.querySelector('[data-testid="exercise-check-answer"]');
                    if (checkBtn && !checkBtn.disabled) {
                        checkBtn.click();
                        observer.disconnect();
                        UI.toast('Resposta validada ⚡', 'success');
                    }
                }, 500);
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['disabled']
            });
        },

        getLocalCache(key) {
            try { return JSON.parse(localStorage.getItem(CONFIG.cachePrefix + key)); } 
            catch { return null; }
        },
        setLocalCache(key, data) {
            try {
                const keys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.cachePrefix));
                if (keys.length > 50) localStorage.removeItem(keys[0]);
                localStorage.setItem(CONFIG.cachePrefix + key, JSON.stringify(data));
            } catch (e) {}
        }
    };

    // Inicializa
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NetworkInterceptor.init());
    } else {
        NetworkInterceptor.init();
    }
    
    console.log('%c[DeepHat Bool] Sistema Ativo ⚡', 'color: #00d2ff; font-weight: bold; font-size: 16px;');
})();