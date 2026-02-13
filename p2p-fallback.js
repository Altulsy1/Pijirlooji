// p2p-fallback.js - نظام اتصال احتياطي للتجربة المحلية

class P2PFallback {
    constructor() {
        this.mode = 'memory'; // memory, broadcast, polling
        this.rooms = new Map();
        this.localRoom = null;
        this.messageCallbacks = [];
    }
    
    // محاكاة اتصال محلي (للتجربة)
    createLocalRoom(roomId) {
        console.log('🎮 إنشاء غرفة محلية:', roomId);
        this.localRoom = {
            id: roomId,
            players: [{
                id: 'local-player',
                name: localStorage.getItem('playerName') || 'المضيف المحلي',
                isHost: true
            }],
            created: Date.now()
        };
        
        this.rooms.set(roomId, this.localRoom);
        
        // محاكاة لاعبين وهميين للتجربة
        setTimeout(() => {
            this.simulatePlayerJoin(roomId, 'أحمد');
            this.simulatePlayerJoin(roomId, 'محمد');
        }, 2000);
        
        return this.localRoom;
    }
    
    simulatePlayerJoin(roomId, name) {
        const room = this.rooms.get(roomId);
        if (room && room.players.length < 4) {
            const newPlayer = {
                id: `bot-${Date.now()}`,
                name: name,
                isHost: false
            };
            room.players.push(newPlayer);
            this.broadcastToRoom(roomId, {
                type: 'player-joined',
                player: newPlayer
            });
        }
    }
    
    // تخزين الرسائل مؤقتاً
    broadcastToRoom(roomId, message) {
        console.log('📢 بث في الغرفة:', roomId, message);
        this.messageCallbacks.forEach(cb => cb({
            roomId,
            message,
            timestamp: Date.now()
        }));
    }
    
    onMessage(callback) {
        this.messageCallbacks.push(callback);
    }
    
    // وضع الاتصال عبر Broadcast Channel (لنفس المتصفح)
    setupBroadcastChannel(roomId) {
        if (window.BroadcastChannel) {
            const channel = new BroadcastChannel(`game-${roomId}`);
            channel.onmessage = (event) => {
                console.log('📡 Broadcast received:', event.data);
                this.messageCallbacks.forEach(cb => cb({
                    roomId,
                    message: event.data,
                    channel: 'broadcast'
                }));
            };
            return channel;
        }
        return null;
    }
    
    // وضع التخزين المشترك (آخر حل)
    setupLocalStorageSync(roomId) {
        // استخدام localStorage كجسر مؤقت
        const storageKey = `game-sync-${roomId}`;
        
        window.addEventListener('storage', (event) => {
            if (event.key === storageKey && event.newValue) {
                try {
                    const message = JSON.parse(event.newValue);
                    this.messageCallbacks.forEach(cb => cb({
                        roomId,
                        message,
                        source: 'storage'
                    }));
                } catch (e) {}
            }
        });
        
        return (message) => {
            localStorage.setItem(storageKey, JSON.stringify({
                ...message,
                _timestamp: Date.now(),
                _sender: Math.random()
            }));
        };
    }
}

// نظام QR Code احتياطي
class QRHelper {
    static generateRoomQR(roomId, elementId) {
        try {
            // محاولة استخدام المكتبة
            QRCode.toCanvas(document.getElementById(elementId), roomId, {
                width: 150,
                margin: 1
            }, (error) => {
                if (error) {
                    // إذا فشلت، استخدم نصاً بديلاً
                    document.getElementById(elementId).style.display = 'none';
                    const container = document.getElementById('qr-code-container');
                    if (container) {
                        container.innerHTML += `
                            <div style="background: #f0f0f0; padding: 10px; border-radius: 10px;">
                                <p>🔑 رمز الغرفة: <strong>${roomId}</strong></p>
                                <p style="font-size: 12px;">(انسخ هذا الرمز وأرسله لأصدقائك)</p>
                            </div>
                        `;
                    }
                }
            });
        } catch (e) {
            console.log('QR Code غير متاح:', e);
        }
    }
    
    static simulateScan() {
        // محاكاة مسح QR في وضع التطوير
        return prompt('🔍 أدخل رمز الغرفة (للتجربة المحلية):');
    }
}

// تهيئة النظام الاحتياطي
window.p2pFallback = new P2PFallback();
window.QRHelper = QRHelper;