// --- 状態管理 ---
const STATE_KEY = 'ai_slide_assistant_state_v1';

// アプリケーションの初期状態定義
// ユーザーの作業中断ごとの復元を可能にするため、全ての可変状態をここに集約する
const defaultState = {
    currentTab: 'slide-support',
    target: 'current',
    chatHistory: [], // { role: 'user' | 'ai', content: string, target?: string }
    genForm: {
        instruction: '',
        usage: null,
        design: 'auto',
        design: 'auto',
        reference: '',
        files: []
    },
    // ユーザー定義テンプレートの永続化用
    customTemplates: []
};

let state = loadState();

// DOM要素のキャッシュ
// 再描画ごとのDOM探索コスト（O(n)）を回避するため、初期化時に一度だけ取得して保持する
let els = {};

// UIテキストマッピング（内部識別子 -> 表示用ラベル）
const targetTextMap = {
    'current': '現在のスライド',
    'selection': '選択テキスト',
    'all': '全スライド'
};

// --- 初期化フロー ---

document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeApplication();
    } catch (error) {
        console.error('Core application initialization failed:', error);
        // ユーザーに致命的なエラーを通知するUIがあればここで表示すべき
    }
});

function initializeApplication() {
    console.log('Init started');
    try {
        // 1. DOM要素の参照を確保
        cacheDomElements();
        console.log('DOM Elements captured', els);

        // 2. 保存された状態に基づいてUIを復元（State Restoration）
        restoreUiState();
        console.log('Render executed');

        // 3. ユーザー操作のイベントリスナーを設定
        attachEventListeners();
        console.log('EventListeners attached');

        // 4. レイアウト調整用のリサイザーを起動
        initResizers();
        console.log('Resizers initialized');

    } catch (e) {
        console.error('初期化中にエラーが発生しました:', e);
    }
}

function cacheDomElements() {
    els = {
        // タブ制御
        tabs: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        footerContents: document.querySelectorAll('.footer-content'),

        // ヘッダー周り（対象範囲選択など）
        targetChip: document.getElementById('target-chip'),
        targetMenu: document.getElementById('target-menu'),
        menuItems: document.querySelectorAll('.menu-item'),

        // スライド支援（Slide Support）タブ
        chatHistory: document.getElementById('chat-history'),
        emptyState: document.getElementById('empty-state'),
        chatInput: document.getElementById('chat-input'),
        sendBtn: document.getElementById('send-btn'),
        templateBtn: document.getElementById('template-btn'),
        templatePanel: document.getElementById('template-panel'),
        closeTemplateBtn: document.getElementById('close-template-panel'),
        addTemplateBtn: document.getElementById('add-template-btn'),
        templateList: document.getElementById('template-list') || document.querySelector('.template-list'),

        // Custom Model Selector (Slide Support)
        modelSelectorSupport: {
            container: document.getElementById('model-selector-custom'),
            trigger: document.getElementById('model-trigger'),
            dropdown: document.getElementById('model-dropdown'),
            selectedText: document.getElementById('selected-model-text'),
            options: document.querySelectorAll('#model-dropdown .model-option'),
            hiddenInput: document.getElementById('model-select-support')
        },

        // Custom Model Selector (Doc Generation)
        modelSelectorGen: {
            container: document.getElementById('model-selector-gen'),
            trigger: document.getElementById('model-trigger-gen'),
            dropdown: document.getElementById('model-dropdown-gen'),
            selectedText: document.getElementById('selected-model-text-gen'),
            options: document.querySelectorAll('#model-dropdown-gen .model-option'),
            hiddenInput: document.getElementById('model-select-gen')
        },

        // Color Picker Elements
        colorPicker: {
            trigger: document.getElementById('color-picker-trigger'),
            popover: document.getElementById('color-picker-popover'),
            previewBox: document.getElementById('current-color-preview'),
            triggerInput: document.getElementById('trigger-hex-input'),
            hiddenInput: document.getElementById('gen-color'),

            svPanel: document.getElementById('sv-panel'),
            svCursor: document.getElementById('sv-cursor'),

            hueSlider: document.getElementById('hue-slider'),
            hueThumb: document.getElementById('hue-thumb'),

            eyedropperBtn: document.getElementById('eyedropper-btn'),
            pickerPreview: document.getElementById('picker-preview-circle'),

            inputR: document.getElementById('input-r'),
            inputG: document.getElementById('input-g'),
            inputB: document.getElementById('input-b'),
            inputHex: document.getElementById('input-hex')
        },

        // 資料生成（Doc Generation）タブ
        tiles: document.querySelectorAll('.tile-option'),
        generateBtn: document.getElementById('generate-btn'),
        modelSelectGen: document.getElementById('model-select-gen'),

        // ファイルアップロード（File Attachment）
        fileDropZone: document.getElementById('file-drop-zone'),
        fileInput: document.getElementById('file-input'),
        fileList: document.getElementById('file-list'),

        // モーダル & 通知（Feedback）
        confirmModal: document.getElementById('confirm-modal'),
        modalConfirmBtn: document.getElementById('modal-confirm'),
        modalCancelBtn: document.getElementById('modal-cancel'),
        toastNotification: document.getElementById('toast'),

        // プレビュー領域（Slide Preview）
        slideTitle: document.querySelector('.slide-title'),
        slideBody: document.querySelector('.slide-body'),

        // テンプレート登録モーダル form要素
        templateModal: document.getElementById('template-modal'),
        templateTitleInput: document.getElementById('tmpl-title'),
        templateDescInput: document.getElementById('tmpl-desc'),
        templateBodyInput: document.getElementById('tmpl-body'),
        templateCancelBtn: document.getElementById('tmpl-cancel'),
        templateSaveBtn: document.getElementById('tmpl-save'),

        // 資料生成フォーム入力
        accordions: document.querySelectorAll('.accordion-header'),
        inputs: {
            instruction: document.getElementById('gen-instruction'),
            usage: document.getElementById('gen-usage'),
        }
    };

    // 必須DOMが欠落している場合は早期に警告する（Fail Fast）
    if (!els.chatInput || !els.generateBtn) {
        console.warn('Critical DOM elements are missing. UI behavior may be unstable.');
    }
}

// ... existing code ...

// --- リサイズロジック ---

function initResizers() {
    console.log('Initializing resizers...');

    // 1. メインの縦方向リサイザー
    setupResizer('resizer-main', 'horizontal', (dx, dy, startWidth, startHeight, target) => {
        const newWidth = startWidth - dx;
        console.log(`Main Resize: dx=${dx}, newWidth=${newWidth}`);
        if (newWidth > 300 && newWidth < 800) {
            target.style.width = `${newWidth}px`;
            target.style.flex = 'none';
        }
    }, () => document.getElementById('task-pane'));

    // 2. フッターの横方向リサイザー
    setupResizer('resizer-footer', 'vertical', (dx, dy, startWidth, startHeight, target) => {
        const newHeight = startHeight - dy;
        console.log(`Footer Resize: dy=${dy}, newHeight=${newHeight}`);
        if (newHeight > 120 && newHeight < 400) {
            target.style.height = `${newHeight}px`;
        }
    }, () => document.getElementById('app-footer'));

    // 3. テンプレートパネルのリサイザー（修正: 垂直配置 / 高さ調整）
    setupResizer('resizer-template', 'vertical', (dx, dy, startWidth, startHeight, target) => {
        // resizerはパネルの上端にある。
        // ドラッグで上(マイナス)に行けば、パネルは広がる（高くなる）。
        // newHeight = startHeight - dy
        const newHeight = startHeight - dy;
        console.log(`Template Resize: dy=${dy}, newHeight=${newHeight}`);

        if (newHeight > 100 && newHeight < 600) {
            target.style.height = `${newHeight}px`;
            // Flexbox (column) なので、チャット履歴は自動的に高さが調節される

            // リサイズ中もスクロール位置を追従させる
            const chatHistory = document.getElementById('chat-history');
            if (chatHistory) {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        }
    }, () => document.getElementById('template-panel'));
}

function setupResizer(resizerId, direction, onResize, getTarget) {
    const resizer = document.getElementById(resizerId);
    if (!resizer) {
        console.error(`Resizer element not found: ${resizerId}`);
        return;
    }

    resizer.addEventListener('mousedown', (e) => {
        console.log(`MouseDown on ${resizerId}`);
        e.preventDefault(); // テキスト選択防止など
        const target = getTarget();
        if (!target) {
            console.error(`Target not found for ${resizerId}`);
            return;
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = target.offsetWidth;
        const startHeight = target.offsetHeight;

        console.log(`Start resize: ${startWidth}x${startHeight}`);

        resizer.classList.add('resizing');
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            // console.log('MouseMove', dx, dy);
            onResize(dx, dy, startWidth, startHeight, target);
        };

        const onMouseUp = () => {
            console.log('MouseUp');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function loadState() {
    try {
        const storedStr = localStorage.getItem(STATE_KEY);
        if (!storedStr) return { ...defaultState };

        const stored = JSON.parse(storedStr);

        // genFormオブジェクトのディープマージ（不足プロパティの補完）
        // これにより、古いステートが残っていても新しいプロパティ(options等)がundefinedにならず、クラッシュを防ぐ
        const genForm = {
            ...defaultState.genForm,
            ...(stored.genForm || {})
        };

        return {
            ...defaultState,
            ...stored,
            genForm: genForm
        };
    } catch (e) {
        console.error('ステート読み込みエラー:', e);
        return { ...defaultState };
    }
}

function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function restoreUiState() {
    // タブの状態復元
    if (state.currentTab) switchTab(state.currentTab, false);

    // 対象設定の復元
    updateTargetUI();

    // チャット履歴の復元
    renderChatHistory();

    // 入力フォームの復元
    restoreForm();

    // 生成ボタンの有効/無効状態を更新
    checkGenerateValidity();
}

function attachEventListeners() {
    // タブ切り替えイベント
    els.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            state.currentTab = tab;
            saveState();
            switchTab(tab);
        });
    });

    // 対象設定メニューの制御
    els.targetChip.addEventListener('click', (e) => {
        const isHidden = els.targetMenu.classList.contains('hidden');
        if (isHidden) els.targetMenu.classList.remove('hidden');
        else els.targetMenu.classList.add('hidden');
        e.stopPropagation();
    });

    // メニュー外クリックで閉じる
    document.addEventListener('click', () => {
        els.targetMenu.classList.add('hidden');
    });

    els.menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.classList.contains('disabled')) return;
            state.target = item.dataset.value;
            saveState();
            updateTargetUI();
        });
    });

    // チャット入力 (IME入力中のEnter送信防止を含む)
    let isComposing = false;
    els.chatInput.addEventListener('compositionstart', () => isComposing = true);
    els.chatInput.addEventListener('compositionend', () => isComposing = false);

    els.chatInput.addEventListener('input', () => {
        els.sendBtn.disabled = els.chatInput.value.trim() === '';
        // 自動高さ調整は手動リサイズと競合するため削除
    });

    els.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            sendMessage();
        }
    });

    els.sendBtn.addEventListener('click', sendMessage);

    // Helper: Scroll chat history to bottom
    const scrollToBottom = () => {
        const chatHistory = document.getElementById('chat-history');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    };

    // テンプレートパネルの表示切り替え
    els.templateBtn.addEventListener('click', () => {
        const isHidden = els.templatePanel.classList.contains('hidden');
        if (isHidden) {
            els.templatePanel.classList.remove('hidden');
            if (document.getElementById('resizer-template')) {
                document.getElementById('resizer-template').classList.remove('hidden');
            }
        } else {
            els.templatePanel.classList.add('hidden');
            if (document.getElementById('resizer-template')) {
                document.getElementById('resizer-template').classList.add('hidden');
            }
        }
        // パネル開閉時にスクロール位置を調整
        setTimeout(scrollToBottom, 50); // レイアウト反映待ち
    });

    els.closeTemplateBtn.addEventListener('click', () => {
        els.templatePanel.classList.add('hidden');
        if (document.getElementById('resizer-template')) {
            document.getElementById('resizer-template').classList.add('hidden');
        }
        setTimeout(scrollToBottom, 50);
    });

    // カスタムテンプレート追加機能 -> モーダル表示
    els.addTemplateBtn.addEventListener('click', () => {
        // フォームリセット
        els.templateTitleInput.value = '';
        els.templateDescInput.value = '';
        els.templateBodyInput.value = '';
        els.templateModal.classList.remove('hidden');
    });

    // テンプレートモーダル操作
    els.templateCancelBtn.addEventListener('click', () => {
        els.templateModal.classList.add('hidden');
    });

    els.templateSaveBtn.addEventListener('click', () => {
        const title = els.templateTitleInput.value.trim();
        const desc = els.templateDescInput.value.trim();
        const body = els.templateBodyInput.value.trim();

        if (!title || !body) {
            alert('タイトルと指示内容は必須です');
            return;
        }

        addTemplate(title, body, desc);
        els.templateModal.classList.add('hidden');
    });

    // テンプレートリストのイベント委譲
    els.templateList.addEventListener('click', (e) => {
        // 削除ボタンクリック時の処理
        if (e.target.closest('.template-delete')) {
            const btn = e.target.closest('.template-delete');
            const item = btn.closest('.template-item');

            // 配列から削除
            // 現在はDOM順序と配列順序が逆（prepend）なので、要素のindexを取得するのは少し複雑
            // プロトタイプなのでDOM上のindexを使って削除する簡易実装にするか、一意なIDを持たせるのが理想
            // ここでは簡易的に「カスタムテンプレートは常に上に追加される」前提で、
            // カスタムテンプレート配列内の該当アイテムを特定して削除する

            // DOM要素自体にindexを持たせるのが手っ取り早い
            const index = parseInt(item.dataset.index);
            if (!isNaN(index)) {
                deleteTemplate(index);
                item.remove();
            }
            return;
        }

        const item = e.target.closest('.template-item');
        if (item) {
            const text = item.dataset.text;
            els.chatInput.value = text;
            els.templatePanel.classList.add('hidden');
            els.chatInput.focus();
            els.sendBtn.disabled = false;
            els.chatInput.dispatchEvent(new Event('input')); // 高さ調整とボタン有効化をトリガー
        }
    });

    // ... existing code ...

    function addTemplate(title, body, desc = '') {
        // カスタムテンプレートのindexを管理
        if (!state.customTemplates) state.customTemplates = [];
        const newIndex = state.customTemplates.length; // 追加前の長さ = 新しいindex (pushなら)

        const div = document.createElement('div');
        div.className = 'template-item custom-item'; // custom-item class for identification
        div.dataset.text = body;
        div.dataset.index = newIndex;

        // descが空の場合はbodyの一部を表示、あればdescを表示
        const displayDesc = desc || (body.substring(0, 15) + (body.length > 15 ? '...' : ''));

        div.innerHTML = `
        <span class="icon">⚡</span>
        <div class="text">
            <span class="title">${title}</span>
            <span class="desc">${displayDesc}</span>
        </div>
        <div class="template-delete" title="削除">×</div>
    `;

        // リストの先頭に追加（デフォルトテンプレートより上）
        els.templateList.insertBefore(div, els.templateList.firstChild);

        state.customTemplates.push({ title, body, desc });
        saveState();
    }

    function deleteTemplate(index) {
        if (!state.customTemplates) return;

        // インデックスで削除するとずれる可能性があるので、
        // 本来はID管理すべきだが、簡易実装として削除時はstateを更新してリロード（再描画）させるのが安全
        // しかし今回はDOM削除のみで対応し、stateからは「無効化」するかspliceするか考える
        // spliceすると他の要素のindexがずれるため、dataset.indexと不整合が起きる

        // 解決策: 配列からは削除し、次回ロード時に反映。DOMは即削除。
        // indexの整合性を保つため、stateも全て再描画するのがベストだが、ちらつきを避けるため
        // spliceして、残りのDOMのdata-indexを更新する

        state.customTemplates.splice(index, 1);
        saveState();

        // indexの再割り当て
        const customItems = els.templateList.querySelectorAll('.custom-item');
        // 注意: insertBeforeで追加しているのでDOM順序は「新しい順」。配列は「古い順」（push）
        // 配列: [Old, New] -> DOM: [New, Old]
        // index: 0 refers to Old.
        // addTemplateの実装で newIndex = length としている (push前提)
        // つまり、dataset.index は 配列のindex と一致している

        // spliceしたあとのindex更新
        customItems.forEach(item => {
            const i = parseInt(item.dataset.index);
            if (i > index) {
                item.dataset.index = i - 1;
            }
        });
    }

    // アコーディオンの開閉制御
    els.accordions.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('open');
        });
    });

    // 資料生成フォーム入力制御
    els.inputs.instruction.addEventListener('input', (e) => {
        state.genForm.instruction = e.target.value;
        saveState();
        checkGenerateValidity();
    });

    els.tiles.forEach(tile => {
        tile.addEventListener('click', () => {
            els.tiles.forEach(t => t.classList.remove('selected'));
            tile.classList.add('selected');
            state.genForm.usage = tile.dataset.value;
            els.inputs.usage.value = tile.dataset.value;
            saveState();
            checkGenerateValidity();
        });
    });

    // --- Color Picker Events ---
    if (els.colorPicker && els.colorPicker.trigger) {
        // Toggle Popover
        els.colorPicker.trigger.addEventListener('click', (e) => {
            // If clicking the input, ignore (let input handle focus)
            if (e.target.classList.contains('trigger-hex-input')) return;

            e.stopPropagation();
            const popover = els.colorPicker.popover;

            if (popover.classList.contains('hidden')) {
                // Show and position
                popover.classList.remove('hidden');

                // Get trigger position
                const rect = els.colorPicker.trigger.getBoundingClientRect();

                // Apply fixed positioning
                popover.style.position = 'fixed';
                popover.style.top = `${rect.bottom + 8}px`; // 8px margin
                popover.style.left = `${rect.left}px`;
                popover.style.zIndex = '9999';

                // Prevent overflowing right edge
                const popRect = popover.getBoundingClientRect();
                if (rect.left + popRect.width > window.innerWidth) {
                    popover.style.left = `${window.innerWidth - popRect.width - 20}px`;
                }

                // Prevent overflowing bottom edge (flip to top if needed)
                if (rect.bottom + popRect.height > window.innerHeight) {
                    popover.style.top = `${rect.top - popRect.height - 8}px`;
                }

            } else {
                popover.classList.add('hidden');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!els.colorPicker.popover.classList.contains('hidden') &&
                !els.colorPicker.popover.contains(e.target) &&
                !els.colorPicker.trigger.contains(e.target)) {
                els.colorPicker.popover.classList.add('hidden');
            }
        });

        // Eyedropper
        if (window.EyeDropper) {
            els.colorPicker.eyedropperBtn.addEventListener('click', async () => {
                const eyeDropper = new EyeDropper();
                try {
                    const result = await eyeDropper.open();
                    setColorFromHex(result.sRGBHex);
                } catch (e) {
                    console.log('Eyedropper cancelled', e);
                }
            });
        } else {
            els.colorPicker.eyedropperBtn.style.display = 'none'; // Not supported
        }

        // Color Logic Setup
        setupColorPickerInteractions();
    } // End if colorPicker

    // ファイルアップロード制御
    if (els.fileDropZone) {
        els.fileDropZone.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', handleFileSelect);

        // ドラッグ＆ドロップ
        els.fileDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            els.fileDropZone.style.backgroundColor = '#EFF6FF';
        });
        els.fileDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            els.fileDropZone.style.backgroundColor = '';
        });
        els.fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            els.fileDropZone.style.backgroundColor = '';
            handleFiles(e.dataTransfer.files);
        });
    }

    // 生成ボタン -> モーダル表示
    els.generateBtn.addEventListener('click', () => {
        if (els.generateBtn.disabled) return;
        els.confirmModal.classList.remove('hidden');
    });

    // モーダル操作
    els.modalCancelBtn.addEventListener('click', () => {
        els.confirmModal.classList.add('hidden');
    });

    els.modalConfirmBtn.addEventListener('click', () => {
        els.confirmModal.classList.add('hidden');
        startGeneration();
    });

    // ... existing code ...
    // Custom Model Selector
    // Custom Model Selector logic handled below in setupCustomModelSelector


    // Custom Model Selector Logic (Reusable)
    const setupCustomModelSelector = (selectorEls, logPrefix = 'Model switched') => {
        const { trigger, dropdown, options, selectedText, hiddenInput, container } = selectorEls;

        if (!trigger || !dropdown) return;

        // Toggle
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 他のドロップダウンを閉じる処理入れたほうが良いが、一旦簡易実装
            dropdown.classList.toggle('hidden');
        });

        // Close outside
        document.addEventListener('click', (e) => {
            if (container && !container.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Selection
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.dataset.value;
                const name = opt.querySelector('.opt-name').textContent;

                // Update UI
                selectedText.textContent = name;

                // Update State/Input
                if (hiddenInput) {
                    hiddenInput.value = value;
                    // Trigger change event if needed for other listeners
                    hiddenInput.dispatchEvent(new Event('change'));
                }

                // Update active class
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');

                // Close
                dropdown.classList.add('hidden');

                console.log(`${logPrefix}: ${value}`);
            });
        });
    };

    // Initialize both selectors
    setupCustomModelSelector(els.modelSelectorSupport, 'Model switched (Support)');
    setupCustomModelSelector(els.modelSelectorGen, 'Model switched (Gen)');
}

// --- ロジック実装 ---

function switchTab(tabId, animate = true) {
    // 全て非表示
    els.tabContents.forEach(el => el.classList.remove('active'));
    els.footerContents.forEach(el => el.classList.remove('active'));
    els.tabs.forEach(el => el.classList.remove('active'));

    // 対象を表示
    document.getElementById(`${tabId}-view`).classList.add('active');
    document.getElementById(`${tabId}-footer`).classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');

    // 「スライド支援」タブの場合のみ対象チップを表示する（厳密な表示制御）
    if (tabId === 'slide-support') {
        els.targetChip.style.display = 'block';
        els.targetChip.style.pointerEvents = 'auto';
        els.targetChip.style.opacity = '1';
    } else {
        els.targetChip.style.display = 'none'; // 完全に隠す
        els.targetMenu.classList.add('hidden'); // 開いていれば閉じる
    }
}

function updateTargetUI() {
    els.targetChip.textContent = `対象: ${targetTextMap[state.target]}`;
    els.menuItems.forEach(item => {
        if (item.dataset.value === state.target) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// チャット機能
function sendMessage() {
    const text = els.chatInput.value.trim();
    if (!text) return;

    // ユーザーメッセージを追加
    addMessage('user', text);

    // 入力をクリア
    els.chatInput.value = '';
    els.sendBtn.disabled = true;

    // ローディング表示
    const loadingId = addLoadingMessage();

    // ネットワーク遅延をシミュレート
    setTimeout(() => {
        removeLoadingMessage(loadingId);
        addMessage('ai', generateDummyResponse(text));
    }, 1500);
}

function addMessage(role, content) {
    state.chatHistory.push({ role, content, target: state.target });
    saveState();
    renderSingleMessage(role, content, state.target);
}

function renderChatHistory() {
    els.chatHistory.innerHTML = '';

    if (state.chatHistory.length === 0) {
        els.chatHistory.appendChild(els.emptyState);
        els.emptyState.style.display = 'flex';
        return;
    } else {
        els.emptyState.style.display = 'none';
    }

    state.chatHistory.forEach(msg => {
        renderSingleMessage(msg.role, msg.content, msg.target);
    });
}

function renderSingleMessage(role, content, target) {
    if (els.emptyState.style.display !== 'none') {
        els.emptyState.style.display = 'none';
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // AIの場合の対象ラベル
    let targetHtml = '';
    if (role === 'ai') {
        targetHtml = `<div class="msg-target">対象: ${targetTextMap[target] || '現在のスライド'}</div>`;
    }

    // ロールに応じたアクションボタン
    let actionsHtml = '';
    if (role === 'ai') {
        actionsHtml = `
            <div class="ai-actions">
                <button class="action-chip" onclick="copyToClipboard(this)">コピー</button>
                <button class="action-chip" onclick="reRun()">再実行</button>
                <button class="action-chip" disabled title="準備中">適用</button>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        <div class="msg-content">
            ${targetHtml}
            ${content}
        </div>
        ${actionsHtml}
    `;

    els.chatHistory.appendChild(msgDiv);
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
}

function addLoadingMessage() {
    const loadingId = 'loading-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.id = loadingId;
    msgDiv.className = 'message ai';
    msgDiv.innerHTML = `
        <div class="msg-content">
            <span class="spinner" style="display:inline-block; border-top-color: #666; width:12px; height:12px;"></span> 考え中...
        </div>
    `;
    els.chatHistory.appendChild(msgDiv);
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
    return loadingId;
}

function removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function generateDummyResponse(userText) {
    // 入力に基づきダミーテキストを返し、スライドを更新する

    if (userText.includes('タイトル')) {
        updateSlideContent('市場をリードする革新的な戦略', null);
        return 'スライドのタイトルを更新しました。\n以前のタイトル：「Q3 Financial Results」';
    }

    if (userText.includes('構造化')) {
        const newBody = `
            <ul>
                <li><strong>現状の課題:</strong> 競合他社の追い上げと価格競争の激化</li>
                <li><strong>解決策:</strong> "Alpha"プロダクトによる差別化とプレミアム化</li>
                <li><strong>期待効果:</strong> 利益率の5%改善とシェア奪還</li>
            </ul>
            <div class="slide-chart-placeholder" style="margin-top:20px;">
                (構造化図解)
            </div>
        `;
        updateSlideContent('事業環境と今後の戦略', newBody);
        return 'スライドの構成を整理して更新しました。';
    }

    if (userText.includes('要約')) {
        const newBody = `
            <p style="font-size: 24px; line-height: 1.6; font-weight: bold; color: #333;">
                Q3は売上高・利益ともに過去最高を更新。<br>
                新製品の寄与により、通期目標の達成は確実視される。
            </p>
        `;
        updateSlideContent(null, newBody);
        return 'スライドの内容を要約して更新しました。';
    }

    if (userText.includes('インサイト') || userText.includes('データ')) {
        const newBody = `
            <div style="display:flex; gap:20px;">
                <div style="flex:1;">
                    <ul>
                        <li>若年層のユーザーが前年比+40%急増</li>
                        <li>モバイル経由のCVRがPCを逆転</li>
                    </ul>
                </div>
                <div style="flex:1; background:#eee; display:flex; align-items:center; justify-content:center;">
                    (データグラフ: ユーザー属性推移)
                </div>
            </div>
       `;
        updateSlideContent('ユーザー属性の変化と示唆', newBody);
        return 'データからインサイトを抽出し、スライドに反映しました。';
    }

    // デフォルトのフォールバック
    updateSlideContent('改善されたスライド案', `
        <ul>
            <li>論点が明確になりました。</li>
            <li>視覚的なインパクトを強化しました。</li>
            <li>アクションアイテムが具体的になりました。</li>
        </ul>
    `);
    return 'ご指示に基づいてスライドを全体的にブラッシュアップしました。';
}

function updateSlideContent(newTitle, newBodyHTML) {
    if (newTitle) {
        els.slideTitle.textContent = newTitle;
        // 更新を示すシンプルな拡大アニメーション
        animateElement(els.slideTitle);
    }

    if (newBodyHTML) {
        els.slideBody.innerHTML = newBodyHTML;
        animateElement(els.slideBody);
    }
}

function animateElement(element) {
    element.style.transition = 'transform 0.3s ease';
    element.style.transform = 'scale(1.02)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 300);
}


// AI操作用ユーティリティ
window.copyToClipboard = (btn) => {
    // コンテンツテキストを取得する処理（実装省略）

    // トーストフィードバックまたはボタンテキスト変更
    const original = btn.textContent;
    btn.textContent = 'コピーしました';
    setTimeout(() => {
        btn.textContent = original;
    }, 2000);
}

window.reRun = () => {
    // 最後のユーザーメッセージを探す
    // 本来は生成したプロンプトを再送するが、プロトタイプではローディングと同一ダミー応答を表示
    const loadingId = addLoadingMessage();
    setTimeout(() => {
        removeLoadingMessage(loadingId);
        addMessage('ai', '再実行しました: \n' + generateDummyResponse('dummy'));
    }, 1500);
}


// 資料自動生成ロジック

function restoreForm() {
    if (!els.inputs) return;
    if (els.inputs.instruction) els.inputs.instruction.value = state.genForm.instruction || '';

    if (state.genForm.usage) {
        if (els.tiles) {
            els.tiles.forEach(t => {
                if (t.dataset.value === state.genForm.usage) t.classList.add('selected');
            });
        }
        if (els.inputs.usage) els.inputs.usage.value = state.genForm.usage;
    }

    // デザイン復元（カラーピッカー）
    if (state.genForm.design && els.colorPicker) {
        setColorFromHex(state.genForm.design);
    }



    // referenceはinput要素が存在しないため削除

    // アップロードされたファイルリストの復元
    updateFileList();
}

function checkGenerateValidity() {
    const hasInstruction = state.genForm.instruction.trim().length > 0;
    const hasUsage = !!state.genForm.usage;

    els.generateBtn.disabled = !(hasInstruction && hasUsage);
}

function startGeneration() {
    if (els.generateBtn.disabled) return;

    // UIローディング状態
    els.generateBtn.disabled = true;
    const spinner = els.generateBtn.querySelector('.spinner');
    const label = els.generateBtn.querySelector('.btn-text');

    spinner.classList.remove('hidden');
    label.textContent = '生成中...';

    // AI生成のシミュレーション
    setTimeout(() => {
        spinner.classList.add('hidden');
        label.textContent = '資料を生成';
        els.generateBtn.disabled = false;

        // 1. スライド内容の更新（左側プレビュー）
        // 要望 14: 生成された資料を即座に開く/更新する
        // 要望 11: システム導入方針決定資料
        const title = "システム導入方針決定資料";
        const body = `
            <div style="font-size: 16px; line-height: 1.6;">
                <h2 style="font-size:20px; border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:16px;">1. 導入目的と背景</h2>
                <p>現在のレガシーシステムにおける運用コスト増大とセキュリティリスクの低減、およびDX推進による業務効率化を目的とする。</p>
                <h2 style="font-size:20px; border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:16px; margin-top:20px;">2. 比較検討結果</h2>
                <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
                    <tr style="background:#f0f0f0;"><th style="border:1px solid #ccc; padding:8px;">項目</th><th style="border:1px solid #ccc; padding:8px;">案A (SaaS)</th><th style="border:1px solid #ccc; padding:8px;">案B (Scratch)</th></tr>
                    <tr><td style="border:1px solid #ccc; padding:8px;">コスト</td><td style="border:1px solid #ccc; padding:8px;">◎ (低)</td><td style="border:1px solid #ccc; padding:8px;">△ (高)</td></tr>
                    <tr><td style="border:1px solid #ccc; padding:8px;">納期</td><td style="border:1px solid #ccc; padding:8px;">◎ (短)</td><td style="border:1px solid #ccc; padding:8px;">△ (長)</td></tr>
                </table>
            </div>
        `;

        updateSlideContent(title, body);

        // 2. トースト表示 (要望 14)
        showToast('資料の生成が完了しました');

    }, 2500);
}

// --- ヘルパー関数 ---

function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
    // 同じファイルを再度選択できるようにvalueをクリア
    e.target.value = '';
}

function handleFiles(files) {
    if (!state.genForm.files) state.genForm.files = [];

    Array.from(files).forEach(file => {
        // 重複チェック (名前とサイズで簡易判定)
        const exists = state.genForm.files.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            // プロトタイプなのでFileオブジェクトそのものではなくメタデータを保存
            // 実際のアプリではFileオブジェクトを保持するか、サーバーへアップロードする
            state.genForm.files.push({
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            });
        }
    });

    saveState();
    updateFileList();
}

function updateFileList() {
    if (!els.fileList) return;
    els.fileList.innerHTML = '';
    const files = state.genForm.files || [];

    if (files.length === 0) {
        // ファイルがない場合の表示（オプション）
        // els.fileList.innerHTML = '<li style="color:#999; font-size:12px; padding:8px;">ファイルは選択されていません</li>';
        return;
    }

    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';

        // サイズ表記の整形 (KB/MB)
        let sizeStr = '';
        if (file.size < 1024) sizeStr = file.size + ' B';
        else if (file.size < 1024 * 1024) sizeStr = (file.size / 1024).toFixed(1) + ' KB';
        else sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

        // アイコン判定
        let icon = '📄';
        if (file.type && file.type.includes('image')) icon = '🖼️';
        if (file.type && file.type.includes('pdf')) icon = '📕';
        if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) icon = '📊';

        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                <span style="font-size:16px;">${icon}</span>
                <div style="display:flex; flex-direction:column; overflow:hidden;">
                    <span style="font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</span>
                    <span style="font-size:10px; color:#999;">${sizeStr}</span>
                </div>
            </div>
            <span class="file-remove" onclick="removeFile(${index})" title="削除">×</span>
        `;
        els.fileList.appendChild(li);
    });
}

// onclick用のグローバルスコープ関数
window.removeFile = (index) => {
    if (!state.genForm.files) return;
    state.genForm.files.splice(index, 1);
    saveState();
    updateFileList();
};

function addTemplate(title, body, desc = '') {
    const btn = document.createElement('button');
    btn.className = 'template-item';
    btn.dataset.text = body;

    // descが空の場合はbodyの一部を表示、あればdescを表示
    const displayDesc = desc || (body.substring(0, 15) + (body.length > 15 ? '...' : ''));

    btn.innerHTML = `
        <span class="icon">⚡</span>
        <div class="text">
            <span class="title">${title}</span>
            <span class="desc">${displayDesc}</span>
        </div>
    `;
    // リストへの追加ロジック
    // プロトタイプ: 先頭に追加
    els.templateList.insertBefore(btn, els.templateList.firstChild);

    // 永続化（プロトタイプでは簡易実装）
    if (!state.customTemplates) state.customTemplates = [];
    state.customTemplates.push({ title, body, desc });
    saveState();
}

function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => {
        els.toast.classList.remove('show');
    }, 3000);
}

// Utility: HSV <-> RGB
function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) h = 0;
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s, v };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function setColorFromHex(hex) {
    if (!/^#[0-9A-F]{6}$/i.test(hex)) return;

    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);

    setColorFromRGB(r, g, b);
}

function setColorFromRGB(r, g, b) {
    currentColor.r = r;
    currentColor.g = g;
    currentColor.b = b;

    const { h, s, v } = rgbToHsv(r, g, b);
    currentColor.h = h;
    currentColor.s = s;
    currentColor.v = v;

    updateColorUI();
}

function updateColorUI() {
    // HSV to RGB
    const { r, g, b } = hsvToRgb(currentColor.h, currentColor.s, currentColor.v);
    currentColor.r = r;
    currentColor.g = g;
    currentColor.b = b;

    const hex = rgbToHex(r, g, b);

    const cp = els.colorPicker;

    // Update Visuals
    // Hue Thumb
    cp.hueThumb.style.left = `${(currentColor.h / 360) * 100}%`;

    // SV Cursor
    cp.svCursor.style.left = `${currentColor.s * 100}%`;
    cp.svCursor.style.top = `${(1 - currentColor.v) * 100}%`;
    cp.svPanel.style.backgroundColor = `hsl(${currentColor.h}, 100%, 50%)`;

    // Previews & Inputs
    cp.previewBox.style.backgroundColor = hex;
    cp.pickerPreview.style.backgroundColor = hex;

    // Update Trigger Input
    if (cp.triggerInput && document.activeElement !== cp.triggerInput) {
        cp.triggerInput.value = hex;
    }

    cp.hiddenInput.value = hex;

    cp.inputR.value = r;
    cp.inputG.value = g;
    cp.inputB.value = b;

    // Update HEX input (without # prefix as per UI design)
    if (cp.inputHex) {
        // Avoid overwriting if user is typing (document.activeElement check could be added)
        // But for simplicity, we update it. If conflict arises, we can add a check.
        if (document.activeElement !== cp.inputHex) {
            cp.inputHex.value = hex.substring(1);
        }
    }

    // Save State
    state.genForm.design = hex;
    saveState();
}

let currentColor = { h: 210, s: 0.74, v: 0.69, r: 46, g: 102, b: 175 }; // Default base

function setupColorPickerInteractions() {
    const cp = els.colorPicker;

    // Hue Slider Interaction
    let isDraggingHue = false;
    cp.hueSlider.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        updateHue(e);
    });

    // SV Panel Interaction
    let isDraggingSV = false;
    cp.svPanel.addEventListener('mousedown', (e) => {
        isDraggingSV = true;
        updateSV(e);
    });

    // Global Mouse Events for Dragging
    document.addEventListener('mousemove', (e) => {
        if (isDraggingHue) updateHue(e);
        if (isDraggingSV) updateSV(e);
    });

    document.addEventListener('mouseup', () => {
        isDraggingHue = false;
        isDraggingSV = false;
    });

    // RGB Inputs
    const updateFromRGB = () => {
        const r = parseInt(cp.inputR.value) || 0;
        const g = parseInt(cp.inputG.value) || 0;
        const b = parseInt(cp.inputB.value) || 0;
        setColorFromRGB(r, g, b);
    };

    [cp.inputR, cp.inputG, cp.inputB].forEach(input => {
        input.addEventListener('input', updateFromRGB);
    });

    // HEX Input in Trigger
    if (cp.triggerInput) {
        // Prevent popover from opening when clicking input
        cp.triggerInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        cp.triggerInput.addEventListener('change', (e) => {
            let val = e.target.value.trim();
            if (!val.startsWith('#')) val = '#' + val;

            if (/^#[0-9A-F]{6}$/i.test(val)) {
                setColorFromHex(val);
            } else {
                // Revert
                const { r, g, b } = currentColor;
                cp.triggerInput.value = rgbToHex(r, g, b);
            }
        });
    }

    // HEX Input in Popover
    if (cp.inputHex) {
        cp.inputHex.addEventListener('change', (e) => {
            let val = e.target.value.trim();
            if (val.startsWith('#')) val = val.substring(1);

            if (/^[0-9A-F]{6}$/i.test(val)) {
                setColorFromHex('#' + val);
            } else {
                // Revert to current valid hex if invalid
                const { r, g, b } = currentColor;
                cp.inputHex.value = rgbToHex(r, g, b).substring(1);
            }
        });

        // Optional: Allow real-time update if valid length 6
        cp.inputHex.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (val.startsWith('#')) val = val.substring(1);
            if (/^[0-9A-F]{6}$/i.test(val)) {
                setColorFromHex('#' + val);
            }
        });
    }

    // Close popover on scroll (capture phase to catch all scrolling containers)
    document.addEventListener('scroll', (e) => {
        // Only close if it's not a scroll *inside* the popover (if popover ever becomes scrollable)
        if (cp.popover && !cp.popover.classList.contains('hidden') && !cp.popover.contains(e.target)) {
            cp.popover.classList.add('hidden');
        }
    }, { capture: true, passive: true });
}

function updateHue(e) {
    const rect = els.colorPicker.hueSlider.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    const percent = x / rect.width;
    currentColor.h = Math.round(percent * 360);

    updateColorUI();
}

function updateSV(e) {
    const rect = els.colorPicker.svPanel.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    currentColor.s = x / rect.width;
    currentColor.v = 1 - (y / rect.height);

    updateColorUI();
}



