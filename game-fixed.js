// game-fixed.js - النسخة المصححة من اللعبة

// ==================== تهيئة متقدمة ====================
console.log('🎮 بدء تشغيل اللعبة...');
console.log('🌐 البيئة:', CONFIG.ENVIRONMENT);
console.log('📢 رسالة:', CONFIG.HELP_MESSAGES[CONFIG.ENVIRONMENT]);

// حالة اللعبة الموسعة
const gameState = {
    // ... (نفس الحالة السابقة مع إضافات)
    connectionMode: 'p2p', // p2p, fallback, local
    connectionStatus: 'disconnected',
    fallbackChannel: null,
    reconnectAttempts: 0,
    messageQueue: [],
    
    // دوال مساعدة
    updateStatus(status) {
        this.connectionStatus = status;
        this.showStatusMessage();
    },
    
    showStatusMessage() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) {
            // إنشاء عنصر الحالة إذا لم يكن موجوداً
            const div = document.createElement('div');
            div.id = 'connection-status';
            div.style.cssText = 'position: fixed; top: 10px; left: 10px; background: #333; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; z-index: 10000;';
            document.body.appendChild(div);
        }
        
        const el = document.getElementById('connection-status');
        if (el) {
            el.textContent = `📶 ${this.connectionStatus}`;
            el.style.background = this.connectionStatus === 'connected' ? '#4caf50' : '#ff6b6b';
        }
    }
};

// ==================== تهيئة PeerJS محسنة ====================
function initializePeerWithFallback() {
    return new Promise((resolve, reject) => {
        console.log('🔌 محاولة الاتصال عبر PeerJS...');
        
        try {
            // محاولة استخدام PeerJS أولاً
            gameState.peer = new Peer({
                // استخدام عدة خوادم STUN
                config: { iceServers: CONFIG.PEER.SERVERS },
                // زيادة مهلة الاتصال
                pingInterval: 5000,
                // إعادة المحاولة تلقائياً
                reconnect: true
            });
            
            gameState.peer.on('open', (id) => {
                console.log('✅ PeerJS متصل بنجاح:', id);
                gameState.playerId = id;
                gameState.connectionMode = 'p2p';
                gameState.updateStatus('متصل (P2P)');
                resolve(id);
            });
            
            gameState.peer.on('error', (error) => {
                console.warn('⚠️ خطأ PeerJS:', error.type);
                
                if (error.type === 'unavailable-id' || error.type === 'network') {
                    // إذا فشل PeerJS، استخدم النظام الاحتياطي
                    console.log('🔄 التبديل إلى النظام الاحتياطي...');
                    initializeFallbackMode().then(resolve).catch(reject);
                } else {
                    reject(error);
                }
            });
            
            // مهلة للتبديل للوضع الاحتياطي
            setTimeout(() => {
                if (!gameState.playerId) {
                    console.log('⏱️ مهلة الاتصال - التبديل للوضع الاحتياطي');
                    initializeFallbackMode().then(resolve).catch(reject);
                }
            }, CONFIG.PEER.CONNECTION_TIMEOUT);
            
        } catch (e) {
            console.error('❌ فشل تهيئة PeerJS:', e);
            initializeFallbackMode().then(resolve).catch(reject);
        }
    });
}

// ==================== النظام الاحتياطي ====================
async function initializeFallbackMode() {
    console.log('🔄 تشغيل النظام الاحتياطي...');
    
    gameState.connectionMode = 'fallback';
    gameState.playerId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // استخدام BroadcastChannel إذا متاح
    if (window.BroadcastChannel) {
        gameState.fallbackChannel = new BroadcastChannel('game-fallback');
        gameState.fallbackChannel.onmessage = (event) => {
            handleFallbackMessage(event.data);
        };
        gameState.updateStatus('وضع الطوارئ (نفس المتصفح)');
    } else {
        // استخدام localStorage كبديل أخير
        setupLocalStorageSync();
        gameState.updateStatus('وضع الطوارئ (تخزين محلي)');
    }
    
    // إضافة رسائل مساعدة
    showFallbackInstructions();
    
    return gameState.playerId;
}

function handleFallbackMessage(data) {
    console.log('📨 رسالة طوارئ:', data);
    
    switch(data.type) {
        case 'player-joined':
            if (!gameState.players[data.player.id]) {
                gameState.players[data.player.id] = data.player;
                updatePlayersList(gameState.players);
            }
            break;
            
        case 'game-start':
            startGameAsClient(data);
            break;
            
        case 'win-press':
            if (gameState.isHost) {
                handleWinPress(data.playerId, data.timestamp);
            }
            break;
    }
}

function showFallbackInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'fallback-instructions';
    instructions.style.cssText = `
        position: fixed;
        bottom: 70px;
        left: 10px;
        right: 10px;
        background: #ffd700;
        color: #333;
        padding: 15px;
        border-radius: 10px;
        font-size: 14px;
        text-align: center;
        z-index: 9998;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    instructions.innerHTML = `
        <strong>⚠️ وضع التجربة المحلية</strong><br>
        • استخدم <strong>نفس المتصفح</strong> للتجربة<br>
        • افتح عدة نوافذ بنفس الرابط<br>
        • استخدم رمز الغرفة: <strong>${gameState.roomId || 'TEST'}</strong><br>
        <button onclick="document.getElementById('fallback-instructions').remove()" style="margin-top:10px; padding:5px 15px;">فهمت</button>
    `;
    document.body.appendChild(instructions);
}

// ==================== تعديل دوال الانضمام ====================
async function createRoom() {
    gameState.isHost = true;
    gameState.roomId = generateRoomCode();
    
    try {
        // محاولة الاتصال عبر PeerJS
        await initializePeerWithFallback();
    } catch (e) {
        console.log('استمرار بالوضع الاحتياطي');
    }
    
    // تحديث الواجهة
    document.getElementById('room-code').textContent = gameState.roomId;
    document.getElementById('invite-link').value = `${window.location.origin}${window.location.pathname}?room=${gameState.roomId}`;
    
    // إنشاء QR أو رمز بديل
    QRHelper.generateRoomQR(gameState.roomId, 'qr-code');
    
    // إضافة اللاعب المضيف
    gameState.players = {
        [gameState.playerId]: {
            name: gameState.playerName,
            isHost: true,
            id: gameState.playerId
        }
    };
    
    updatePlayersList(gameState.players);
    showScreen('lobby');
    
    // إذا كنا في وضع الطوارئ، أضف لاعبين وهميين للتجربة
    if (gameState.connectionMode === 'fallback') {
        simulateLocalPlayers();
    }
}

function simulateLocalPlayers() {
    // محاكاة لاعبين للتجربة المحلية
    const testPlayers = ['أحمد', 'محمد', 'فاطمة'];
    
    testPlayers.forEach((name, index) => {
        setTimeout(() => {
            const botId = `test-${index}-${Date.now()}`;
            gameState.players[botId] = {
                name: name,
                isHost: false,
                id: botId,
                bot: true
            };
            updatePlayersList(gameState.players);
            
            // تفعيل زر البدء
            document.getElementById('start-game-btn').disabled = false;
            document.getElementById('start-game-btn').textContent = '🚀 ابدأ اللعبة (تجريبي)';
            
        }, 1000 * (index + 1));
    });
}

async function joinRoom(roomId) {
    gameState.roomId = roomId;
    gameState.isHost = false;
    
    try {
        await initializePeerWithFallback();
    } catch (e) {
        console.log('انضمام بالوضع الاحتياطي');
    }
    
    if (gameState.connectionMode === 'p2p') {
        // محاولة الاتصال بالمضيف
        const conn = gameState.peer.connect(roomId);
        setupConnection(conn);
    } else {
        // وضع الطوارئ - مجرد إشعار
        alert('🧪 وضع التجربة: سيتم محاكاة الاتصال');
        
        // محاكاة انضمام ناجح
        setTimeout(() => {
            showScreen('lobby');
            document.getElementById('room-code').textContent = roomId;
            
            // محاكاة قائمة لاعبين
            gameState.players = {
                'host-1': { name: 'المضيف', isHost: true, id: 'host-1' },
                [gameState.playerId]: { name: gameState.playerName, isHost: false, id: gameState.playerId }
            };
            updatePlayersList(gameState.players);
            
        }, 1000);
    }
}

// ==================== دوال مساعدة للتجربة ====================
function generateRoomCode() {
    return 'ROOM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ==================== اختبار اللعبة محلياً ====================
function testLocalMultiplayer() {
    // دالة لاختبار اللعبة بنفس المتصفح
    console.log('🧪 بدء اختبار محلي...');
    
    // فتح نوافذ متعددة للتجربة
    const baseUrl = window.location.origin + window.location.pathname;
    
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            window.open(baseUrl, `_blank${i}`);
        }, i * 1000);
    }
}

// إضافة زر الاختبار في وضع التطوير
if (CONFIG.ENVIRONMENT === 'development') {
    setTimeout(() => {
        const testBtn = document.createElement('button');
        testBtn.textContent = '🧪 اختبار محلي';
        testBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 10000; background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 25px; font-size: 14px; cursor: pointer;';
        testBtn.onclick = testLocalMultiplayer;
        document.body.appendChild(testBtn);
    }, 2000);
}

// ==================== بدء التشغيل ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 تهيئة اللعبة...');
    
    // تحميل الاسم المحفوظ
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
        gameState.playerName = savedName;
    }
    
    // التحقق من وجود رمز غرفة في الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomId = urlParams.get('room') || urlParams.get('join');
    
    if (joinRoomId) {
        // انضمام تلقائي إذا وجد رمز
        setTimeout(() => {
            showScreen('join');
            document.getElementById('room-code-input').value = joinRoomId;
        }, 2000);
    }
    
    // إخفاء شاشة البداية
    setTimeout(() => {
        showScreen('mainMenu');
    }, 2000);
});

// تصدير الدوال الأساسية
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.testLocalMultiplayer = testLocalMultiplayer;