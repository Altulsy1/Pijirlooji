// game-modern.js - النسخة المتطورة والمصححة للعبة

class ModernGame {
    constructor() {
        this.state = {
            playerId: null,
            playerName: localStorage.getItem('playerName') || 'لاعب',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
            isHost: false,
            roomId: null,
            players: {},
            gameData: {
                currentRound: 1,
                roundWinner: null,
                playersCards: {},
                gameActive: false,
                startTime: null
            },
            stats: this.loadStats(),
            unsubscribeFunctions: [] // لمزامنة Firebase
        };
        
        this.timerInterval = null;
        this.useFirebase = true; // تفعيل Firebase تلقائياً
        this.db = null;
        this.rtdb = null;
        
        this.init();
    }
    
    async init() {
        this.loadStats();
        this.setupEventListeners();
        this.updatePlayerDisplay();
        this.startBackgroundAnimation();
        this.simulateOnlineCount();
        
        // تهيئة Firebase إذا كان متاحاً
        if (this.useFirebase && typeof firebase !== 'undefined') {
            await this.initFirebase();
        }
    }
    
    // تهيئة Firebase
    async initFirebase() {
        try {
            const firebaseConfig = {
                apiKey: "AIzaSyDeOQuQ2umGELjT8wNIw9vJr613Fxj1Dg0",
                authDomain: "kin-tien.firebaseapp.com",
                projectId: "kin-tien",
                storageBucket: "kin-tien.firebasestorage.app",
                messagingSenderId: "285420896766",
                appId: "1:285420896766:web:234ee65007d9333c1200af",
                measurementId: "G-X8W7Y7Z72P"
            };
            
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            
            this.db = firebase.firestore();
            this.rtdb = firebase.database();
            console.log('✅ Firebase initialized');
            
        } catch (error) {
            console.warn('⚠️ Firebase غير متاح، استخدام الوضع المحلي');
            this.useFirebase = false;
        }
    }
    
    setupEventListeners() {
        // أزرار القائمة
        document.getElementById('create-room-btn')?.addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn')?.addEventListener('click', () => this.showJoinScreen());
        document.getElementById('single-player-btn')?.addEventListener('click', () => this.startSinglePlayer());
        document.getElementById('edit-name-btn')?.addEventListener('click', () => this.changeName());
        
        // أزرار الغرفة
        document.getElementById('start-game-btn')?.addEventListener('click', () => this.startGame());
        
        // أزرار اللعبة
        document.getElementById('done-button')?.addEventListener('click', () => this.pressWinButton());
        
        // أزرار المودال
        document.getElementById('next-round-btn')?.addEventListener('click', () => {
            document.getElementById('result-modal')?.classList.add('hidden');
            this.initializeRound();
        });
        
        document.getElementById('end-game-btn')?.addEventListener('click', () => {
            document.getElementById('result-modal')?.classList.add('hidden');
            this.showScreen('main-menu');
        });
        
        // مشاركة
        document.querySelectorAll('.invite-btn').forEach(btn => {
            btn.addEventListener('click', () => this.shareInvite());
        });
    }
    
    // تحديث عرض اللاعب
    updatePlayerDisplay() {
        document.getElementById('player-name-display').textContent = this.state.playerName;
        document.getElementById('menu-player-name').textContent = this.state.playerName;
        
        const avatars = document.querySelectorAll('.player-avatar img');
        avatars.forEach(img => {
            img.src = this.state.avatar;
        });
    }
    
    // تغيير الاسم
    changeName() {
        const newName = prompt('أدخل اسمك الجديد', this.state.playerName);
        if (newName && newName.trim()) {
            this.state.playerName = newName.trim();
            localStorage.setItem('playerName', this.state.playerName);
            this.state.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`;
            this.updatePlayerDisplay();
            this.showToast('تم تحديث الاسم بنجاح', 'success');
        }
    }
    
    // إنشاء غرفة
    async createRoom() {
        this.state.isHost = true;
        this.state.roomId = this.generateRoomCode();
        this.state.playerId = 'host_' + Date.now();
        
        if (this.useFirebase && this.db) {
            await this.createRoomWithFirebase();
        } else {
            await this.createRoomLocally();
        }
    }
    
    // إنشاء غرفة باستخدام Firebase
    async createRoomWithFirebase() {
        try {
            await this.db.collection('rooms').doc(this.state.roomId).set({
                hostId: this.state.playerId,
                hostName: this.state.playerName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'waiting',
                players: {
                    [this.state.playerId]: {
                        name: this.state.playerName,
                        avatar: this.state.avatar,
                        isHost: true,
                        joinedAt: new Date().toISOString()
                    }
                },
                playerCount: 1,
                maxPlayers: 4,
                gameState: null
            });
            
            this.listenToRoomChanges();
            this.showScreen('lobby');
            this.updateLobbyDisplay();
            this.generateQRCode();
            this.showToast('✅ تم إنشاء الغرفة بنجاح', 'success');
            
        } catch (error) {
            console.error('خطأ في إنشاء الغرفة:', error);
            this.showToast('❌ فشل إنشاء الغرفة', 'error');
        }
    }
    
    // إنشاء غرفة محلياً
    async createRoomLocally() {
        try {
            this.showScreen('lobby');
            this.updateLobbyDisplay();
            this.generateQRCode();
            this.showToast('تم إنشاء الغرفة محلياً', 'success');
            
            // محاكاة انضمام لاعبين
            this.simulatePlayers();
            
        } catch (error) {
            console.error('فشل إنشاء الغرفة:', error);
            this.showToast('فشل الاتصال', 'error');
        }
    }
    
    // الاستماع لتغييرات الغرفة (Firebase)
    listenToRoomChanges() {
        if (!this.db || !this.state.roomId) return;
        
        const unsubscribe = this.db.collection('rooms')
            .doc(this.state.roomId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const roomData = doc.data();
                    this.state.players = roomData.players || {};
                    this.updatePlayersList(roomData.players);
                    
                    if (roomData.status === 'playing' && !this.state.gameData.gameActive) {
                        this.startGameFromFirebase(roomData.gameState);
                    }
                }
            });
        
        this.state.unsubscribeFunctions.push(unsubscribe);
    }
    
    // تحديث قائمة اللاعبين
    updatePlayersList(players) {
        const playersGrid = document.getElementById('players-grid');
        if (!playersGrid) return;
        
        playersGrid.innerHTML = '';
        const playersArray = Object.entries(players || {}).map(([id, data]) => ({ id, ...data }));
        
        // إضافة اللاعب المضيف أولاً
        const hostPlayer = playersArray.find(p => p.isHost);
        if (hostPlayer) {
            this.addPlayerCard(playersGrid, hostPlayer, true);
        }
        
        // إضافة باقي اللاعبين
        playersArray.filter(p => !p.isHost).forEach(player => {
            this.addPlayerCard(playersGrid, player, false);
        });
        
        // إضافة خانات فارغة
        for (let i = playersArray.length; i < 4; i++) {
            this.addEmptyCard(playersGrid);
        }
        
        this.updateStartButton(playersArray.length);
    }
    
    addPlayerCard(container, player, isHost) {
        const card = document.createElement('div');
        card.className = `player-card ${isHost ? 'host-card' : ''}`;
        card.innerHTML = `
            <div class="player-avatar large">
                <img src="${player.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + player.id}" alt="">
            </div>
            <div class="player-name">${player.name}</div>
            ${isHost ? '<div class="player-badge host-badge">المضيف</div>' : ''}
        `;
        container.appendChild(card);
    }
    
    addEmptyCard(container) {
        const card = document.createElement('div');
        card.className = 'player-card empty-card';
        card.innerHTML = `
            <div class="empty-icon">👤</div>
            <div class="empty-text">انتظار...</div>
        `;
        container.appendChild(card);
    }
    
    updateStartButton(playerCount) {
        const startBtn = document.getElementById('start-game-btn');
        const countElement = document.getElementById('player-count');
        
        if (countElement) {
            countElement.textContent = `${playerCount}/4`;
        }
        
        if (startBtn) {
            if (this.state.isHost && playerCount >= 2) {
                startBtn.classList.remove('disabled');
                startBtn.disabled = false;
            } else {
                startBtn.classList.add('disabled');
                startBtn.disabled = true;
            }
        }
    }
    
    // محاكاة لاعبين (للوضع المحلي)
    simulatePlayers() {
        if (!this.useFirebase) {
            setTimeout(() => {
                const mockPlayers = {
                    ...this.state.players,
                    'player2': {
                        name: 'Player 2',
                        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=player2',
                        isHost: false
                    }
                };
                this.updatePlayersList(mockPlayers);
            }, 3000);
        }
    }
    
    // شاشة الانضمام
    showJoinScreen() {
        const roomCode = prompt('أدخل رمز الغرفة:');
        if (roomCode && roomCode.trim()) {
            this.joinRoom(roomCode.trim().toUpperCase());
        }
    }
    
    // الانضمام إلى غرفة
    async joinRoom(roomCode) {
        this.state.roomId = roomCode;
        this.state.playerId = 'player_' + Date.now();
        
        if (this.useFirebase && this.db) {
            await this.joinRoomWithFirebase(roomCode);
        } else {
            this.showToast('الانضمام متاح فقط مع Firebase', 'error');
        }
    }
    
    async joinRoomWithFirebase(roomCode) {
        try {
            const roomDoc = await this.db.collection('rooms').doc(roomCode).get();
            
            if (!roomDoc.exists) {
                this.showToast('❌ الغرفة غير موجودة', 'error');
                return;
            }
            
            const roomData = roomDoc.data();
            
            if (roomData.playerCount >= roomData.maxPlayers) {
                this.showToast('❌ الغرفة ممتلئة', 'error');
                return;
            }
            
            await this.db.collection('rooms').doc(roomCode).update({
                [`players.${this.state.playerId}`]: {
                    name: this.state.playerName,
                    avatar: this.state.avatar,
                    isHost: false,
                    joinedAt: new Date().toISOString()
                },
                playerCount: roomData.playerCount + 1
            });
            
            this.listenToRoomChanges();
            this.showScreen('lobby');
            this.showToast('✅ تم الانضمام للغرفة', 'success');
            
        } catch (error) {
            console.error('خطأ في الانضمام:', error);
            this.showToast('❌ فشل الانضمام', 'error');
        }
    }
    
    // توليد رمز الغرفة
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        const codeElement = document.getElementById('room-code');
        if (codeElement) codeElement.textContent = code;
        return code;
    }
    
    // توليد QR code
    generateQRCode() {
        const roomUrl = `${window.location.origin}${window.location.pathname}?join=${this.state.roomId}`;
        const canvas = document.getElementById('qr-code');
        
        if (canvas && typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, roomUrl, {
                width: 150,
                margin: 1,
                color: { dark: '#6C5CE7', light: '#FFFFFF' }
            }, (error) => {
                if (error) {
                    console.error('QR Error:', error);
                    this.showQRFallback();
                }
            });
        } else {
            this.showQRFallback();
        }
    }
    
    showQRFallback() {
        const container = document.getElementById('qr-code-container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 20px; background: #F0F0F0; border-radius: 15px;">
                    <i class="fas fa-link" style="font-size: 2rem; color: #6C5CE7;"></i>
                    <p style="margin-top: 10px;">الرمز: ${this.state.roomId}</p>
                </div>
            `;
        }
    }
    
    // بدء اللعبة
    startGame() {
        if (!this.state.isHost) return;
        
        this.showScreen('game');
        this.initializeRound();
        
        if (this.useFirebase && this.db) {
            this.db.collection('rooms').doc(this.state.roomId).update({
                status: 'playing',
                gameState: {
                    currentRound: this.state.gameData.currentRound,
                    startTime: Date.now()
                }
            });
        }
        
        this.playSound('start');
        this.triggerHaptic('medium');
    }
    
    // تهيئة جولة
    initializeRound() {
        this.state.gameData.gameActive = true;
        this.state.gameData.roundWinner = null;
        this.dealCards();
        this.startTimer(60);
        this.updateGameUI();
    }
    
    // توزيع البطاقات
    dealCards() {
        const fruits = ['🍎', '🍌', '🍊', '🍇', '🍓', '🍉', '🍒', '🍍'];
        const allCards = [];
        
        for (let i = 0; i < 16; i++) {
            const fruitIndex = Math.floor(Math.random() * fruits.length);
            allCards.push({
                id: `card-${i}-${Date.now()}`,
                emoji: fruits[fruitIndex],
                name: this.getFruitName(fruits[fruitIndex]),
                fruitId: fruitIndex
            });
        }
        
        const players = [this.state.playerId, ...Object.keys(this.state.players)];
        players.forEach((playerId, index) => {
            const playerCards = allCards.slice(index * 4, (index + 1) * 4);
            this.state.gameData.playersCards[playerId] = playerCards;
            
            if (playerId === this.state.playerId) {
                this.displayMyCards(playerCards);
            }
        });
    }
    
    // عرض البطاقات
    displayMyCards(cards) {
        const container = document.getElementById('cards-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'modern-card';
            cardEl.style.animationDelay = `${index * 0.1}s`;
            cardEl.innerHTML = `
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-name">${card.name}</div>
            `;
            
            cardEl.addEventListener('click', () => this.selectCard(card));
            container.appendChild(cardEl);
        });
        
        document.getElementById('cards-count').textContent = `${cards.length}/4`;
        this.checkWinCondition(cards);
    }
    
    selectCard(card) {
        this.showToast(`${card.name}`, 'info');
    }
    
    // التحقق من الفوز
    checkWinCondition(cards) {
        const counts = {};
        cards.forEach(card => {
            counts[card.emoji] = (counts[card.emoji] || 0) + 1;
        });
        
        const hasFour = Object.values(counts).some(count => count >= 4);
        const winBtn = document.getElementById('done-button');
        
        if (winBtn && hasFour) {
            winBtn.classList.remove('disabled');
            winBtn.disabled = false;
            this.animateWinButton();
            this.showToast('لديك 4 من نفس النوع!', 'success');
        }
    }
    
    // زر الفوز
    pressWinButton() {
        if (this.state.gameData.roundWinner) return;
        
        this.triggerHaptic('heavy');
        this.launchConfetti();
        
        if (this.state.isHost) {
            this.handleWin(this.state.playerId);
        }
    }
    
    // معالجة الفوز
    handleWin(playerId) {
        this.state.gameData.roundWinner = playerId;
        this.state.gameData.gameActive = false;
        this.stopTimer();
        
        const winTime = Math.floor((Date.now() - this.state.gameData.startTime) / 1000);
        
        if (playerId === this.state.playerId) {
            this.updateStats('win', winTime);
        }
        
        this.showWinner(playerId, winTime);
    }
    
    // إظهار الفائز
    showWinner(playerId, time) {
        const winnerName = playerId === this.state.playerId ? 
            this.state.playerName : 
            this.state.players[playerId]?.name || 'الخصم';
        
        document.getElementById('result-title').textContent = `🎉 ${winnerName} فاز!`;
        document.getElementById('result-message').textContent = `جمع 4 بطاقات في ${time} ثانية`;
        document.getElementById('round-time').textContent = `${time}s`;
        document.getElementById('win-streak').textContent = this.state.stats.winStreak || 0;
        document.getElementById('result-modal').classList.remove('hidden');
        
        this.launchConfetti();
        
        if (playerId === this.state.playerId) {
            this.triggerHaptic('success');
        }
    }
    
    // المؤقت
    startTimer(seconds) {
        this.state.gameData.startTime = Date.now();
        let timeLeft = seconds;
        
        this.timerInterval = setInterval(() => {
            timeLeft--;
            
            const progress = (timeLeft / seconds) * 283;
            const timerProgress = document.getElementById('timer-progress');
            const gameTimer = document.getElementById('game-timer');
            
            if (timerProgress) timerProgress.style.strokeDashoffset = progress;
            if (gameTimer) gameTimer.textContent = timeLeft;
            
            if (timeLeft <= 10) {
                const timerText = document.querySelector('.timer-text');
                if (timerText) timerText.style.color = '#FF7675';
            }
            
            if (timeLeft <= 0) {
                this.endRound();
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    // نهاية الجولة
    endRound() {
        this.stopTimer();
        this.state.gameData.gameActive = false;
        
        let maxCount = 0;
        let winner = null;
        
        Object.entries(this.state.gameData.playersCards).forEach(([playerId, cards]) => {
            const counts = {};
            cards.forEach(card => {
                counts[card.emoji] = (counts[card.emoji] || 0) + 1;
            });
            const playerMax = Math.max(...Object.values(counts));
            
            if (playerMax > maxCount) {
                maxCount = playerMax;
                winner = playerId;
            }
        });
        
        if (winner) {
            this.handleWin(winner);
        }
    }
    
    // تأثيرات
    animateWinButton() {
        const btn = document.getElementById('done-button');
        if (btn) {
            btn.style.animation = 'pulse 0.5s infinite';
            setTimeout(() => {
                btn.style.animation = '';
            }, 3000);
        }
    }
    
    launchConfetti() {
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6C5CE7', '#00D2FF', '#FF7675', '#FDCB6E']
            });
        }
    }
    
    triggerHaptic(intensity = 'light') {
        if (!window.navigator.vibrate) return;
        
        const patterns = {
            light: [10],
            medium: [30, 10, 30],
            heavy: [50, 20, 50, 20, 50],
            success: [100, 50, 200]
        };
        
        window.navigator.vibrate(patterns[intensity] || patterns.light);
    }
    
    playSound(type) {
        console.log('Sound:', type);
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // مشاركة
    shareInvite() {
        if (!this.state.roomId) return;
        
        const roomUrl = `${window.location.origin}${window.location.pathname}?join=${this.state.roomId}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'انضم إلى لعبة Fruit Clash',
                text: 'تعال العب معي لعبة الفواكه الأربعة',
                url: roomUrl
            });
        } else {
            navigator.clipboard.writeText(roomUrl);
            this.showToast('تم نسخ رابط الدعوة', 'success');
        }
    }
    
    // إحصائيات
    loadStats() {
        const saved = localStorage.getItem('fruitGameStats');
        return saved ? JSON.parse(saved) : {
            gamesPlayed: 0,
            wins: 0,
            fastestWin: null,
            winStreak: 0,
            totalCards: 0
        };
    }
    
    updateStats(type, value) {
        if (type === 'win') {
            this.state.stats.wins++;
            this.state.stats.winStreak++;
            
            if (!this.state.stats.fastestWin || value < this.state.stats.fastestWin) {
                this.state.stats.fastestWin = value;
            }
        }
        
        this.state.stats.gamesPlayed++;
        localStorage.setItem('fruitGameStats', JSON.stringify(this.state.stats));
    }
    
    // محاكاة أعداد حية
    simulateOnlineCount() {
        setInterval(() => {
            const online = Math.floor(Math.random() * 200) + 50;
            const onlineEl = document.getElementById('online-count');
            if (onlineEl) onlineEl.textContent = online;
            
            const games = Math.floor(Math.random() * 1000) + 500;
            const gamesEl = document.getElementById('games-count');
            if (gamesEl) {
                gamesEl.textContent = games > 1000 ? (games/1000).toFixed(1) + 'k' : games;
            }
        }, 5000);
    }
    
    // حركات خلفية
    startBackgroundAnimation() {
        setInterval(() => {
            const fruits = document.querySelectorAll('.fruit-icon');
            fruits.forEach(fruit => {
                fruit.style.transform = `translateY(${Math.sin(Date.now() / 500) * 10}px)`;
            });
        }, 50);
    }
    
    // إظهار الشاشات
    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        const screenMap = {
            'main-menu': 'main-menu',
            'lobby': 'lobby-screen',
            'game': 'game-screen',
            'mainMenu': 'main-menu',
            'join': 'join-screen'
        };
        
        const targetId = screenMap[screenName] || screenName;
        const targetScreen = document.getElementById(targetId);
        
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
        } else {
            console.warn('الشاشة غير موجودة:', screenName);
        }
    }
    
    // دوال مساعدة
    getFruitName(emoji) {
        const names = {
            '🍎': 'تفاح',
            '🍌': 'موز',
            '🍊': 'برتقال',
            '🍇': 'عنب',
            '🍓': 'فراولة',
            '🍉': 'بطيخ',
            '🍒': 'كرز',
            '🍍': 'أناناس'
        };
        return names[emoji] || 'فاكهة';
    }
    
    startSinglePlayer() {
        this.showToast('وضع اللاعب الواحد قريباً', 'info');
    }
    
    updateLobbyDisplay() {
        const playerName = this.state.playerName;
        const hostCard = document.querySelector('.host-card .player-name');
        if (hostCard) hostCard.textContent = playerName;
    }
    
    updateGameUI() {
        const roundEl = document.getElementById('round-number');
        if (roundEl) roundEl.textContent = this.state.gameData.currentRound;
    }
    
    // تنظيف عند الخروج
    async leaveRoom() {
        if (this.useFirebase && this.db && this.state.roomId) {
            try {
                await this.db.collection('rooms').doc(this.state.roomId).update({
                    [`players.${this.state.playerId}`]: firebase.firestore.FieldValue.delete(),
                    playerCount: firebase.firestore.FieldValue.increment(-1)
                });
                
                this.state.unsubscribeFunctions.forEach(unsub => {
                    if (typeof unsub === 'function') unsub();
                });
                
            } catch (error) {
                console.error('خطأ في الخروج:', error);
            }
        }
        
        this.showScreen('main-menu');
        this.showToast('تم الخروج', 'info');
    }
}

// ===========================================
// الدوال العامة للوصول من HTML
// ===========================================

function goBack() {
    if (window.game) {
        window.game.showScreen('main-menu');
    }
}

function copyRoomCode() {
    const code = document.getElementById('room-code')?.textContent;
    if (code && window.game) {
        navigator.clipboard.writeText(code);
        window.game.showToast('تم نسخ الرمز', 'success');
    }
}

function showGameMenu() {
    document.getElementById('side-menu')?.classList.remove('hidden');
}

function closeSideMenu() {
    document.getElementById('side-menu')?.classList.add('hidden');
}

function quickJoinRandom() {
    if (window.game) {
        window.game.showJoinScreen();
    }
}

function openTutorial() {
    if (window.game) {
        window.game.showToast('شرح اللعبة قريباً', 'info');
    }
}

function showStats() {
    if (window.game?.state?.stats) {
        const stats = window.game.state.stats;
        alert(`📊 إحصائياتك:
        🎮 ألعاب: ${stats.gamesPlayed || 0}
        🏆 فوز: ${stats.wins || 0}
        ⚡ أسرع فوز: ${stats.fastestWin || '--'} ثانية
        🔥 فوز متتالي: ${stats.winStreak || 0}`);
    }
}

function leaveGame() {
    if (confirm('هل تريد الخروج من اللعبة؟')) {
        if (window.game) {
            window.game.leaveRoom();
        }
        closeSideMenu();
    }
}

function shareInvite() {
    if (window.game) {
        window.game.shareInvite();
    }
}

function showSettings() {
    if (window.game) {
        window.game.showToast('الإعدادات قريباً', 'info');
    }
}

function showHowToPlay() {
    if (window.game) {
        window.game.showToast('كيفية اللعب قريباً', 'info');
    }
}

function shareApp() {
    if (navigator.share) {
        navigator.share({
            title: 'Fruit Clash',
            text: 'لعبة الفواكه الأربعة',
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(window.location.href);
        if (window.game) {
            window.game.showToast('تم نسخ الرابط', 'success');
        }
    }
}

// ===========================================
// تهيئة اللعبة
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    window.game = new ModernGame();
    
    setTimeout(() => {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('main-menu')?.classList.remove('hidden');
    }, 2500);
});
