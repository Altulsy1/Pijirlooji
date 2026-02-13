// config.js - إعدادات اللعبة المتقدمة

const CONFIG = {
    // إعدادات PeerJS
    PEER: {
        // استخدام خواديم عامة للتجربة
        SERVERS: [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
            { url: 'stun:stun2.l.google.com:19302' },
            { url: 'stun:stun3.l.google.com:19302' },
            { url: 'stun:stun4.l.google.com:19302' },
            // خادم TURN مجاني للتجربة (ضروري لبعض الشبكات)
            {
                url: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
        // مهلة الاتصال
        CONNECTION_TIMEOUT: 10000, // 10 ثواني
        // محاولات إعادة الاتصال
        RECONNECT_ATTEMPTS: 3
    },
    
    // إعدادات اللعبة
    GAME: {
        MAX_PLAYERS: 4,
        MIN_PLAYERS: 2,
        ROUND_TIME: 60,
        CARDS_PER_PLAYER: 4
    },
    
    // وضع التشغيل (تغيير تلقائي حسب البيئة)
    get ENVIRONMENT() {
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'development';
        }
        if (location.protocol === 'https:') {
            return 'production';
        }
        return 'fallback';
    },
    
    // رسائل المساعدة
    HELP_MESSAGES: {
        development: '🚀 وضع التطوير - تأكد من تشغيل خادم محلي',
        production: '🌐 وضع الإنتاج - يجب استخدام HTTPS',
        fallback: '⚠️ وضع الطوارئ - استخدم رمز الغرفة يدوياً'
    }
};

// تصدير الإعدادات
window.CONFIG = CONFIG;