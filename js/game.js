// --- 8-bit Audio System ---
const AudioSys = {
    ctx: null,
    init: function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    },
    playTone: function(freq, type, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; // square, sawtooth, triangle, sine
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    click: function() { this.playTone(440, 'square', 0.1); },
    coin: function() { 
        this.playTone(1200, 'square', 0.1); 
        setTimeout(() => this.playTone(1600, 'square', 0.2), 100);
    },
    explosion: function() { this.playTone(100, 'sawtooth', 0.5); },
    jump: function() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
};

// --- Game State ---
const State = {
    day: 1,
    maxDays: 7,
    cash: 1000, // 现金 (USDT)
    amount: 0,  // 持仓数量 (COIN)
    price: 10,  // 当前价格
    priceYesterday: 10, // 昨日价格
    totalAssetsYesterday: 1000, // 昨日总资产
    lastNightPnL: 0, // 昨晚盈亏
    lastNightPnLPercent: 0, // 昨晚盈亏百分比
    history: [], // For K-line
    nightHistory: [], // Micro-movements during night
    nightTargetPrice: 0, // 夜间目标价格
    currentEvent: null, // 当日事件
    nextDayChange: 0, // 次日涨跌幅
    eventHistory: [], // 记录所有事件历史
    alphaHistory: [], // 记录每日alpha值
    totalHistory: [], // 记录每日总资产
    minTotalReached: 1000, // 历史最低总资产
    maxTotalReached: 1000, // 历史最高总资产
    stats: {
        trades: 0,
        allIns: 0,
        panicSells: 0,
        maxProfit: 0,
        maxLoss: 0,
        bullishEvents: 0, // 利好事件计数
        bearishEvents: 0, // 利空事件计数
        blackSwanEvents: 0, // 黑天鹅事件计数
        contraryActions: 0, // 反向操作计数
        luckEvents: 0, // 幸运事件计数（利好事件且持仓>0）
        changeCount: 0, // 仓位变动次数
        maxDrawdown: 0, // 最大回撤
        timingScore: 50, // 择时得分 (0-100)
        avgAlpha: 0 // 平均alpha值
    },
    pendingAction: 'HOLD', // BUY, SELL, HOLD
    pendingAmount: 0, // Amount in percentage 0-100
    sliderValue: 50 // 滑杆位置 (0-100)
};
// 7日事件池 - 按天数和类型分类
const EventPools = {
    D1: { // 种子期
        '利好-A': { text: "获得顶级 VC 种子轮融资，机构背书极强。", range: [25, 35], tier: 'A' },
        '利好-B': { text: "测试网运行极其流畅，TPS 突破预期。", range: [10, 15], tier: 'B' },
        '利空-A': { text: "某大 V 质疑其核心代码全是复用 PPT。", range: [-18, -12], tier: 'B' },
        '利空-B': { text: "核心开发者被爆出曾有\"归零项目\"前科。", range: [-25, -15], tier: 'A' },
        '黑天鹅': { text: "创始人身份造假，实为在逃惯犯。", range: [-99, -99], tier: 'S+' },
        '噪音': { text: "市场恐慌与贪婪指数为 50，波动细微。", range: [-1, 1], tier: 'C' }
    },
    D2: { // 发酵期
        '利好-A': { text: "某顶级 KOL 宣布加入顾问委员会。", range: [15, 20], tier: 'B' },
        '利好-B': { text: "社区喊话\"大的要来了\"，群友刷屏 LFG。", range: [8, 12], tier: 'B' },
        '利空-A': { text: "电报群遭黑客潜入，发放虚假预售链接。", range: [-20, -15], tier: 'B' },
        '利空-B': { text: "监测到项目方多签钱包有 5% 筹码移动。", range: [-30, -20], tier: 'A' },
        '黑天鹅': { text: "某主权国家宣布将该技术用于国家骨干网。", range: [150, 200], tier: 'S+' }
    },
    D3: { // 上线期
        '利好-A': { text: "顶级交易所正式宣布开启合约交易。", range: [35, 50], tier: 'A' },
        '利好-B': { text: "上线首小时交易额突破 1 亿美元。", range: [12, 18], tier: 'B' },
        '利空-A': { text: "早期种子轮投资者开始大规模获利砸盘。", range: [-35, -25], tier: 'A' },
        '利空-B': { text: "创始人因\"不可抗力\"突然失联。", range: [-60, -40], tier: 'S' },
        '黑天鹅': { text: "被指控涉嫌洗钱，全网交易所强制下架。", range: [-99, -95], tier: 'S+' }
    },
    D4: { // 生态期
        '利好-A': { text: "宣布与主流 Layer 2 达成战略协作。", range: [15, 25], tier: 'A' },
        '利好-B': { text: "质押池（Staking）上线，锁仓量飙升。", range: [10, 15], tier: 'B' },
        '利空-A': { text: "官方推特被盗，发布利空虚假澄清。", range: [-30, -20], tier: 'B' },
        '利空-B': { text: "SEC 发布监管函，质疑其属于证券。", range: [-35, -25], tier: 'A' },
        '噪音': { text: "机器人账号在 X 平台转发虚假空投。", range: [-3, -1], tier: 'C' }
    },
    D5: { // 博弈期
        '利好-A': { text: "监测到远古巨鲸高价吸筹并锁仓。", range: [25, 35], tier: 'A' },
        '利好-B': { text: "项目方宣布启动大规模回购计划。", range: [12, 20], tier: 'B' },
        '利空-A': { text: "某巨鲸将巨量沉睡筹码转入交易所准备套现。", range: [-45, -30], tier: 'A' },
        '利空-B': { text: "传闻某大户因爆仓被强制平仓。", range: [-20, -15], tier: 'B' },
        '黑天鹅': { text: "主流稳定币突然脱锚，引发全网去杠杆抛售。", range: [-70, -60], tier: 'S+' }
    },
    D6: { // 危机期
        '利好-A': { text: "聪明钱地址在暴跌中逆势抄底。", range: [12, 18], tier: 'B' },
        '利好-B': { text: "成功修复之前传闻的漏洞，技术安全性提升。", range: [8, 12], tier: 'B' },
        '利空-A': { text: "确认为安全漏洞，黑客已盗走部分资产。", range: [-30, -20], tier: 'S' },
        '利空-B': { text: "市场进入审美疲劳期，成交量萎缩 70%。", range: [-15, -10], tier: 'B' },
        '黑天鹅': { text: "那个卷毛骗了所有人！交易所金库空空如也。区块链要毁灭了，快逃！", range: [-99, -80], tier: 'S+' }
    },
    D7: { // 终局期
        '利好-A': { text: "官方销毁机制生效，总量缩减 20%。", range: [80, 150], tier: 'S' },
        '利好-B': { text: "宣布将迁移至性能更强的新链，获得重生。", range: [40, 60], tier: 'A' },
        '利空-A': { text: "核心合约遭重入攻击，池子被抽干。", range: [-99, -90], tier: 'S+' },
        '利空-B': { text: "创始人发布声明称\"累了\"。", range: [-35, -20], tier: 'S' }
    }
};

// --- DOM Elements ---
const screens = {
    start: document.getElementById('start-screen'),
    day: document.getElementById('day-screen'),
    end: document.getElementById('end-screen'),
    hud: document.getElementById('night-hud')
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
// --- Core Logic ---
function initGame() {
    console.log('Initializing game...');
    console.log('Document ready state:', document.readyState);
    
    try {
        lucide.createIcons();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Start Button - 添加更强的错误处理
        const startBtn = document.getElementById('btn-start');
        console.log('Start button found:', startBtn);
        
        if (startBtn) {
            // 移除可能存在的旧事件监听器
            startBtn.replaceWith(startBtn.cloneNode(true));
            const newStartBtn = document.getElementById('btn-start');
            
            newStartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Start button clicked!');
                try {
                    AudioSys.init();
                    AudioSys.coin();
                    startGame();
                } catch (error) {
                    console.error('Error starting game:', error);
                }
            });
            
            // 添加视觉反馈
            newStartBtn.addEventListener('mousedown', () => {
                newStartBtn.style.transform = 'translate(4px, 4px)';
                newStartBtn.style.boxShadow = '0px 0px 0px #000';
            });
            
            newStartBtn.addEventListener('mouseup', () => {
                newStartBtn.style.transform = '';
                newStartBtn.style.boxShadow = '4px 4px 0px #000';
            });
            
            console.log('Start button event listeners attached successfully');
        } else {
            console.error('Start button not found!');
            // 尝试延迟重试
            setTimeout(() => {
                console.log('Retrying button initialization...');
                initGame();
            }, 100);
            return;
        }
    } catch (error) {
        console.error('Error in initGame:', error);
    }
    
    // Slider Logic - 滑杆百分比：-1到1，中间为0（Hold）
    const slider = document.getElementById('trade-slider');
    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        // 将滑杆值0-100转换为-1到1的alpha值
        const alpha = (val - 50) / 50; // 0->-1, 50->0, 100->1
        
        // 检查限制条件
        if (alpha < 0 && State.amount <= 0) {
            // 没有持仓时不能卖出，强制回到中间位置
            slider.value = 50;
            State.sliderValue = 50;
            document.getElementById('action-text').innerText = "Hold";
            document.getElementById('action-text').className = "text-yellow-400 font-bold";
            State.pendingAction = 'HOLD';
            return;
        }
        
        if (alpha > 0 && State.cash <= 0) {
            // 没有现金时不能买入，强制回到中间位置
            slider.value = 50;
            State.sliderValue = 50;
            document.getElementById('action-text').innerText = "Hold";
            document.getElementById('action-text').className = "text-yellow-400 font-bold";
            State.pendingAction = 'HOLD';
            return;
        }
        
        State.sliderValue = val;
        const actionText = document.getElementById('action-text');
        
        if (alpha > 0.1) {
            // 买入：alpha > 0，数值越大买入越多
            const buyPercent = (alpha * 100).toFixed(0);
            actionText.innerText = `Buy ${buyPercent}%`;
            actionText.className = "text-green-400 font-bold";
            State.pendingAction = 'BUY';
        } else if (alpha < -0.1) {
            // 卖出：alpha < 0，数值越小卖出越多
            const sellPercent = (Math.abs(alpha) * 100).toFixed(0);
            actionText.innerText = `Sell ${sellPercent}%`;
            actionText.className = "text-red-400 font-bold";
            State.pendingAction = 'SELL';
        } else {
            // 持有：alpha接近0
            actionText.innerText = `Hold`;
            actionText.className = "text-yellow-400 font-bold";
            State.pendingAction = 'HOLD';
        }
    });
    
    // Sleep Button
    document.getElementById('btn-sleep').addEventListener('click', () => {
        AudioSys.click();
        executeTrade();
        startNight();
    });
    
    // Restart
    document.getElementById('btn-restart').addEventListener('click', () => {
        AudioSys.coin();
        resetState();
        switchScreen('start'); // 回到开始界面而不是直接进入游戏
    });
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function resetState() {
    State.day = 1;
    State.cash = 1000;
    State.amount = 0; // 初始持仓为0，符合游戏设定
    State.price = 10; // 初始开盘价 $10
    State.priceYesterday = 10;
    State.totalAssetsYesterday = 1000;
    State.lastNightPnL = 0;
    State.lastNightPnLPercent = 0;
    State.history = [10];
    State.eventHistory = [];
    State.alphaHistory = [];
    State.totalHistory = [1000];
    State.minTotalReached = 1000;
    State.maxTotalReached = 1000;
    State.currentEvent = null;
    State.nextDayChange = 0;
    State.sliderValue = 50;
    State.stats = { 
        trades: 0, allIns: 0, panicSells: 0, maxProfit: 0, maxLoss: 0,
        bullishEvents: 0,
        bearishEvents: 0,
        blackSwanEvents: 0,
        contraryActions: 0,
        luckEvents: 0,
        changeCount: 0,
        maxDrawdown: 0,
        timingScore: 50,
        avgAlpha: 0
    };
}

function startGame() {
    switchScreen('day');
    updateDayUI();
}

function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden-screen'));
    
    if(name === 'night') {
        screens.hud.classList.remove('hidden');
    } else {
        screens.hud.classList.add('hidden');
        if (name === 'start') screens.start.classList.remove('hidden-screen');
        if (name === 'day') screens.day.classList.remove('hidden-screen');
        if (name === 'end') screens.end.classList.remove('hidden-screen');
    }
}
function generateDailyEvent() {
    const dayKey = `D${State.day}`;
    const dayPool = EventPools[dayKey];
    
    if (!dayPool) {
        // 如果没有对应天数的事件池，使用默认事件
        return {
            type: '噪音',
            text: "市场平静，没有重大消息。",
            range: [-2, 2],
            tier: 'C'
        };
    }
    
    // 从当日事件池中随机选择一个事件
    const eventTypes = Object.keys(dayPool);
    const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const event = dayPool[randomType];
    
    // 计算次日涨跌幅
    const [min, max] = event.range;
    const changePercent = min + Math.random() * (max - min);
    
    // 记录事件统计
    if (randomType.includes('利好')) {
        State.stats.bullishEvents++;
    } else if (randomType.includes('利空')) {
        State.stats.bearishEvents++;
    } else if (randomType === '黑天鹅') {
        State.stats.blackSwanEvents++;
    }
    
    return {
        type: randomType,
        text: event.text,
        changePercent: changePercent,
        tier: event.tier,
        range: event.range
    };
}

function updateDayUI() {
    const event = generateDailyEvent();
    State.currentEvent = event;
    State.nextDayChange = event.changePercent;
    
    // 记录事件历史
    State.eventHistory.push({
        day: State.day,
        event: event,
        priceBeforeEvent: State.price
    });
    
    // 计算总资产
    const totalAssets = Math.floor(State.cash + (State.amount * State.price));
    
    document.getElementById('day-num').innerText = State.day;
    document.getElementById('total-assets').innerText = totalAssets;
    document.getElementById('daily-news').innerText = event.text;
    document.getElementById('current-price-display').innerText = State.price.toFixed(0);
    document.getElementById('cash-balance').innerText = Math.floor(State.cash);
    document.getElementById('amount-balance').innerText = State.amount.toFixed(2);
    
    // 显示昨晚盈亏 (第一天不显示)
    const pnlSection = document.getElementById('pnl-section');
    if (State.day > 1) {
        pnlSection.classList.remove('hidden');
        const pnlText = document.getElementById('pnl-text');
        if (State.lastNightPnL >= 0) {
            pnlText.innerText = `You gain $${Math.abs(State.lastNightPnL).toFixed(0)}(${State.lastNightPnLPercent.toFixed(1)}%) in the night!`;
            pnlText.className = "text-green-400";
        } else {
            pnlText.innerText = `You lose $${Math.abs(State.lastNightPnL).toFixed(0)}(${Math.abs(State.lastNightPnLPercent).toFixed(1)}%) in the night!`;
            pnlText.className = "text-red-400";
        }
    } else {
        pnlSection.classList.add('hidden');
    }
    
    // 隐藏具体的事件等级和预期影响，只显示模糊的市场情绪
    const moodTexts = [
        "市场情绪波动中...",
        "投资者观望态度明显",
        "交易量出现异常变化", 
        "技术面信号混杂",
        "资金流向扑朔迷离"
    ];
    const randomMood = moodTexts[Math.floor(Math.random() * moodTexts.length)];
    document.getElementById('news-effect').innerText = randomMood;
    
    // Reset slider
    const slider = document.getElementById('trade-slider');
    slider.value = 50;
    State.sliderValue = 50;
    document.getElementById('action-text').innerText = "Hold";
    document.getElementById('action-text').className = "text-yellow-400 font-bold";
    State.pendingAction = 'HOLD';
}

function executeTrade() {
    // 保存交易前的状态
    const cashYesterday = State.cash;
    const amountYesterday = State.amount;
    
    // 检查反向操作逻辑
    const isBullishEvent = State.currentEvent && State.currentEvent.type.includes('利好');
    const isBearishEvent = State.currentEvent && State.currentEvent.type.includes('利空');
    
    // 将滑杆值0-100转换为-1到1的alpha值
    const alpha = (State.sliderValue - 50) / 50; // 0->-1, 50->0, 100->1
    
    // 记录alpha历史
    State.alphaHistory.push(alpha);
    
    // 检查仓位变动
    if (Math.abs(alpha) > 0.1) {
        State.stats.changeCount++;
    }
    
    if (alpha > 0) {
        // 买入操作：alpha > 0，用alpha比例的现金买入
        // 示例：alpha=0.5，用50%现金买入
        // 计算交易额：Cash_yesterday * alpha
        const tradeAmount = cashYesterday * alpha;
        // 扣除现金：Cash_new = Cash_yesterday - 交易额
        State.cash = cashYesterday - tradeAmount;
        // 增加持仓：Amount_new = Amount_yesterday + (交易额 / Price)
        State.amount = amountYesterday + (tradeAmount / State.price);
        
        State.stats.trades++;
        if (alpha > 0.9) State.stats.allIns++;
        if (isBearishEvent) State.stats.contraryActions++;
        
        // 择时得分：利好时买入加分
        if (isBullishEvent) {
            State.stats.timingScore += 10;
        } else if (isBearishEvent) {
            State.stats.timingScore -= 15;
        }
    } else if (alpha < 0) {
        // 卖出操作：alpha < 0，卖出|alpha|比例的持仓
        // 示例：alpha=-0.4，卖出40%持仓
        const sellRatio = Math.abs(alpha); // 0.0 ~ 1.0
        // 计算卖出数量：Amount_yesterday * sellRatio
        const sellAmount = amountYesterday * sellRatio;
        // 减少持仓：Amount_new = Amount_yesterday - 卖出数量
        State.amount = amountYesterday - sellAmount;
        // 增加现金：Cash_new = Cash_yesterday + (卖出数量 * Price)
        State.cash = cashYesterday + (sellAmount * State.price);
        
        State.stats.trades++;
        if (sellRatio > 0.9) State.stats.panicSells++;
        if (isBullishEvent) State.stats.contraryActions++;
        
        // 择时得分：利空时卖出加分
        if (isBearishEvent) {
            State.stats.timingScore += 10;
        } else if (isBullishEvent) {
            State.stats.timingScore -= 15;
        }
    } else {
        // HOLD: alpha = 0，不改变持仓和现金
        State.amount = amountYesterday;
        State.cash = cashYesterday;
    }
    
    // 确保数值不为负
    if (State.cash < 0) State.cash = 0;
    if (State.amount < 0) State.amount = 0;
    
    // 确保择时得分在0-100范围内
    State.stats.timingScore = Math.max(0, Math.min(100, State.stats.timingScore));
}
// --- NIGHT SIMULATION (The Core) ---
let animationId;
let nightProgress = 0;
let nightDuration = 180; // Frames (约3秒，平衡节奏与体验)
let currentNightPrice = 0;
let particles = [];

function startNight() {
    switchScreen('night');
    nightProgress = 0;
    State.nightHistory = [];
    currentNightPrice = State.price;
    particles = []; // Reset fireworks
    
    // 更新HUD天数显示
    document.getElementById('night-day-num').innerText = State.day;
    document.getElementById('total-days').innerText = State.maxDays;
    
    // 保存今日开始时的总资产用于PnL计算
    State.nightStartVal = State.cash + (State.amount * State.price);
    
    animateNight();
}

function animateNight() {
    ctx.fillStyle = '#0f172a'; // Night Sky
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Stars
    ctx.fillStyle = '#FFF';
    if (Math.random() > 0.8) ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
    
    nightProgress++;
    
    // 1. Calculate Price Movement - 基于事件驱动的价格变动，增强视觉效果
    let change = 0;
    if (nightProgress === 1) {
        // 第一帧：设定起始价格和目标价格
        const eventChangePercent = State.nextDayChange / 100;
        State.nightTargetPrice = State.price * (1 + eventChangePercent);
        if (State.nightTargetPrice < 0.01) State.nightTargetPrice = 0.01;
        currentNightPrice = State.price; // 从当前价格开始
        change = 0;
    } else {
        // 后续帧：渐进式趋向目标价格，增加波动幅度
        const targetPrice = State.nightTargetPrice;
        const progressRatio = nightProgress / nightDuration; // 0到1的进度
        
        // 基础趋势：逐渐趋向目标价格
        const trendPrice = State.price + (targetPrice - State.price) * progressRatio;
        
        // 增强的随机波动：根据事件强度调整波动幅度
        const eventMagnitude = Math.abs(State.nextDayChange) / 100; // 事件强度
        const volatilityMultiplier = Math.max(0.02, eventMagnitude * 0.3); // 最小2%，最大30%的波动
        
        // 添加周期性波动，让走势更有趣
        const cyclicWave = Math.sin(nightProgress * 0.1) * volatilityMultiplier * 0.5;
        const randomWave = (Math.random() - 0.5) * volatilityMultiplier;
        
        // 合成最终价格
        const totalWave = cyclicWave + randomWave;
        currentNightPrice = trendPrice * (1 + totalWave);
        if (currentNightPrice < 0.01) currentNightPrice = 0.01;
        
        change = currentNightPrice - (State.nightHistory[State.nightHistory.length - 1] || State.price);
    }
    
    State.nightHistory.push(currentNightPrice);
    
    // Keep history length manageable for drawing
    if (State.nightHistory.length > canvas.width / 5) {
        State.nightHistory.shift();
    }
    
    // 2. Draw K-Line (Simplified as Line chart for smooth animation)
    ctx.beginPath();
    ctx.strokeStyle = change >= 0 ? '#4ade80' : '#ef4444';
    ctx.lineWidth = 4;
    
    // Map price to screen Y - 调整缩放让变化更明显
    // Dynamic scale with enhanced range
    let minP = Math.min(...State.nightHistory, State.price);
    let maxP = Math.max(...State.nightHistory, State.price);
    
    // 确保有足够的价格范围显示
    const priceRange = maxP - minP;
    if (priceRange < State.price * 0.05) { // 如果变化太小，强制扩大范围
        const center = (minP + maxP) / 2;
        const expandedRange = State.price * 0.05; // 至少5%的价格范围
        minP = center - expandedRange / 2;
        maxP = center + expandedRange / 2;
    } else {
        // 正常情况下稍微扩大边界，让图表更清晰
        minP *= 0.98;
        maxP *= 1.02;
    }
    
    const range = maxP - minP;
    const getY = (p) => canvas.height - ((p - minP) / range) * (canvas.height * 0.7) - (canvas.height * 0.15);
    
    for (let i = 0; i < State.nightHistory.length; i++) {
        const x = (i / State.nightHistory.length) * (canvas.width - 100); // Leave room for bed
        const y = getY(State.nightHistory[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 3. Draw Bed & Character
    const bedX = canvas.width - 100;
    const bedY = getY(currentNightPrice);
    drawBed(ctx, bedX, bedY, change, State.amount > 0);
    
    // 4. Update HUD PnL - 显示快速变动的美元金额
    const currentTotalAssets = State.cash + (State.amount * currentNightPrice);
    const pnlAmount = currentTotalAssets - State.nightStartVal;
    
    // 添加一些随机波动，让数值看起来在快速变动
    const volatility = Math.abs(pnlAmount) * 0.05; // 5%的波动范围
    const randomFluctuation = (Math.random() - 0.5) * 2 * volatility;
    const displayPnL = pnlAmount + randomFluctuation;
    
    const pnlEl = document.getElementById('night-pnl');
    pnlEl.innerText = (displayPnL >= 0 ? "+" : "") + "$" + Math.abs(displayPnL).toFixed(1);
    pnlEl.className = `text-3xl pixel-font font-bold ${displayPnL >= 0 ? 'text-green-400' : 'text-red-400'}`;
    
    // 5. Special Events / Particles
    if (Math.abs(displayPnL) > 50 && State.amount > 0) {
        // Happy / Fireworks for big moves (盈亏超过$50)
        if (Math.random() > 0.85) createFirework(bedX, bedY);
    }
    updateParticles();
    
    // 6. Danmaku Logic (Random Events) - 加快弹幕频率
    if (Math.random() > 0.92) {
        spawnDanmaku();
    }
    
    // Loop or End Night
    if (nightProgress < nightDuration) {
        animationId = requestAnimationFrame(animateNight);
    } else {
        // 夜晚结束，应用最终价格变动
        endNight();
    }
}

function drawBed(ctx, x, y, delta, hasCoin) {
    ctx.save();
    ctx.translate(x, y);
    
    // Determine Mood
    let mood = 'sleep'; // neutral
    if (hasCoin) {
        if (delta > 0.5) mood = 'rocket'; // Mooning
        else if (delta < -0.5) mood = 'panic'; // Crash
    } else {
        // Short/Empty logic
        if (delta < -0.5) mood = 'smug'; // Dodged bullet
        else if (delta > 0.5) mood = 'cry'; // Missed out
    }
    
    // Bed Base
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-20, 10, 40, 10); // Frame
    ctx.fillStyle = '#FFF';
    ctx.fillRect(-18, 5, 36, 8); // Mattress
    ctx.fillStyle = '#DDD';
    ctx.fillRect(10, 0, 10, 8); // Pillow
    
    // Character
    if (mood === 'rocket') {
        // Rocket Bed!
        ctx.fillStyle = 'orange';
        ctx.fillRect(-25, 15, 50, 10); // Fire
        // Happy Guy
        drawGuy(ctx, 0, 0, '^_^');
    } else if (mood === 'panic') {
        // Tilted Bed
        ctx.rotate(Math.PI / 4);
        drawGuy(ctx, 0, 0, 'O_O');
    } else if (mood === 'smug') {
        drawGuy(ctx, 0, 0, '-_-'); // Sleeping peacefully while world burns
        // Shield effect
        ctx.strokeStyle = '#00f3ff';
        ctx.beginPath();
        ctx.arc(0, 5, 30, 0, Math.PI*2);
        ctx.stroke();
    } else if (mood === 'cry') {
        drawGuy(ctx, 0, 0, 'T_T');
    } else {
        drawGuy(ctx, 0, 0, 'zZZ');
    }
    
    ctx.restore();
}

function drawGuy(ctx, x, y, face) {
    ctx.fillStyle = '#fca5a5'; // Skin
    ctx.fillRect(-5, -10, 10, 10); // Head
    ctx.fillStyle = '#3b82f6'; // PJ
    ctx.fillRect(-8, 0, 25, 5); // Body lying down
    
    // Draw sleep bubble (zZZ) above head, not on face
    if (face === 'zZZ' || face === '^_^' || face === 'O_O' || face === '-_-') {
        // Draw bubble above head
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        
        // Bubble circles
        ctx.beginPath();
        ctx.arc(3, -18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(6, -24, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Sleep text in bubble
        ctx.fillStyle = '#000';
        ctx.font = '8px monospace';
        ctx.fillText('Z', 1, -16);
        ctx.fillText('Z', 5, -22);
        ctx.fillText('Z', 9, -27);
    } else {
        // For other emotions (T_T), draw on face
        ctx.fillStyle = '#000';
        ctx.font = '10px monospace';
        ctx.fillText(face, -5, -2);
    }
}

function createFirework(x, y) {
    for(let i=0; i<10; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 50,
            color: Math.random() > 0.5 ? '#fbbf24' : '#ff00ff'
        });
    }
    AudioSys.explosion();
}

function updateParticles() {
    for(let i=particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        
        if(p.life <= 0) particles.splice(i, 1);
    }
}

function spawnDanmaku() {
    const texts = [
        "HODL!!!", "To the Moon! 🚀", "Scam?", "Buy the dip", "RIP Shorts",
        "WAGMI", "NGMI", "Diamond Hands", "Paper Hands", "Rekt",
        "FOMO", "FUD", "Pump it", "Dump it", "Bull run?",
        "Bear market", "Satoshi mode", "When lambo?", "Have fun staying poor",
        " rug pull", "Pajeet", "KYC not needed", "DeFi summer", "2 the moon",
        "LFG!!!", "Safe moon", "DOGE to $1", "Elon tweet?", "Whale alert",
        "Gas is crazy", "Layer 2", "Stonks", "Meme coin", "Ape in!",
        "Buidl", "Serenity now", "Flippening", "Alt season?", "HODL till death"
    ];
    
    const text = texts[Math.floor(Math.random()*texts.length)];
    const el = document.createElement('div');
    el.className = "danmaku text-white font-bold pixel-font";
    el.innerText = text;
    el.style.top = Math.random() * 200 + "px";
    el.style.color = Math.random() > 0.5 ? "#4ade80" : "#ef4444";
    el.style.fontSize = (Math.random() * 0.5 + 0.8) + "rem"; // 随机大小
    
    document.getElementById('danmaku-container').appendChild(el);
    setTimeout(() => el.remove(), 4000);
}
function endNight() {
    // 1. 计算新价格：Price_today = Price_yesterday * (1 + 波动系数R)
    const priceYesterday = State.price;
    const changePercent = State.nextDayChange / 100; // 转换为小数
    State.price = priceYesterday * (1 + changePercent);
    
    // 确保价格不为负
    if (State.price < 0.01) State.price = 0.01;
    
    // 2. 计算总资产：Total_today = Cash + (Amount * Price_today)
    const totalToday = State.cash + (State.amount * State.price);
    
    // 3. 计算昨晚盈亏：PnL = Amount * (Price_today - Price_yesterday)
    State.lastNightPnL = State.amount * (State.price - priceYesterday);
    
    // 4. 计算昨晚盈亏百分比：PnL% = (PnL / Total_yesterday) * 100%
    if (State.totalAssetsYesterday > 0) {
        State.lastNightPnLPercent = (State.lastNightPnL / State.totalAssetsYesterday) * 100;
    } else {
        State.lastNightPnLPercent = 0;
    }
    
    // 5. 更新统计数据
    State.totalHistory.push(totalToday);
    State.minTotalReached = Math.min(State.minTotalReached, totalToday);
    State.maxTotalReached = Math.max(State.maxTotalReached, totalToday);
    
    // 计算最大回撤
    if (State.maxTotalReached > 0) {
        const currentDrawdown = (State.maxTotalReached - totalToday) / State.maxTotalReached;
        State.stats.maxDrawdown = Math.max(State.stats.maxDrawdown, currentDrawdown);
    }
    
    // 检查幸运事件（利好事件且有持仓）
    if (State.currentEvent && State.currentEvent.type.includes('利好') && State.amount > 0) {
        State.stats.luckEvents++;
    }
    
    // 计算平均alpha
    if (State.alphaHistory.length > 0) {
        const sumAlpha = State.alphaHistory.reduce((sum, alpha) => sum + Math.abs(alpha), 0);
        State.stats.avgAlpha = sumAlpha / State.alphaHistory.length;
    }
    
    // 6. 更新昨日总资产为今日总资产
    State.totalAssetsYesterday = totalToday;
    
    // 7. 记录价格历史
    State.history.push(State.price);
    
    // 8. 检查是否爆仓（提前结束游戏）
    if (totalToday <= 10) {
        showEnding(true); // 传入爆仓标志
        return;
    }
    
    // 9. 进入下一天
    State.day++;
    if (State.day > State.maxDays) {
        showEnding(false);
    } else {
        switchScreen('day');
        updateDayUI();
    }
}
function showEnding(isBankrupt = false) {
    switchScreen('end');
    
    const total = Math.floor(State.cash + (State.amount * State.price));
    document.getElementById('final-score').innerText = total;
    
    const roi = ((total - 1000) / 1000) * 100;
    const roiEl = document.getElementById('roi-text');
    roiEl.innerText = `ROI: ${roi.toFixed(1)}%`;
    roiEl.className = roi >= 0 ? "text-green-400 text-lg" : "text-red-400 text-lg";
    
    // 改进的分层称号判定逻辑
    let title = "幸存者";
    let desc = "平稳度过了7天的考验，虽然平凡但也是一种成就。在这疯狂的币圈，能活下来就是胜利。下次试试加仓位？";
    
    // ========== 第0层：死亡判定（最高优先级） ==========
    if (total <= 10) {
        if (State.currentEvent && State.currentEvent.type === '利空-A' && State.day === 7) {
            title = "协议陪葬者";
            desc = "在终局的重入攻击中失去一切，与协议共同沉没。这就是DeFi的魅力与残酷，一夜之间，归零归零。下次记得审计代码。";
        } else if (State.day <= 2 && State.eventHistory.some(h => h.day === 1 && h.event.type === '黑天鹅')) {
            title = "首席送财官";
            desc = "开局即遭遇黑天鹅，两天内光速爆仓离场。你的1000U已经成为项目方的拉盘燃料。感谢为币圈做出的贡献！";
        } else if (State.day >= 6) {
            title = "功亏一篑";
            desc = "挺过了六天风雨，却在黎明前倒下...可惜。明明已经看到了终点，却被最后一浪拍死在沙滩上。心态崩了呀兄弟。";
        } else {
            title = "天台常客";
            desc = "资产归零，又是从天台一跃而下的一天。这里风景不错，全是老熟人，挤得要命。下次记得设置止损，别老来这打卡。";
        }
    }
    // ========== 第1层：传奇表现（ROI > 200%） ==========
    else if (roi > 200) {
        if (State.stats.luckEvents >= 3) {
            title = "欧皇降世";
            desc = "天选之子！运气爆表，连续捕获超级利好事件。项目方拉盘时你都在场，暴跌时你完美躲过。建议出门买彩票，别玩币了。";
        } else if (State.stats.timingScore >= 85 && State.stats.maxDrawdown < 0.3) {
            title = "量化之神";
            desc = "完美的择时+精准风控，你就是传说中的量化大神。每一笔交易都经过精密计算，回撤小得像不存在。华尔街喊你回去上班。";
        } else if (State.stats.allIns >= 2) {
            title = "梭哈之王";
            desc = "富贵险中求！All-in三次以上还能活下来，真是命大。你的操作让专业交易员心脏骤停，但结果证明：你才是对的。";
        } else {
            title = "币圈传奇";
            desc = "七天内资产翻三倍，这段经历足以载入史册！你的收益曲线比比特币还陡，项目方看了都得喊你一声大哥。";
        }
    }
    // ========== 第2层：卓越表现（ROI > 100%） ==========
    else if (roi > 100) {
        if (State.stats.timingScore >= 80) {
            title = "趋势猎手";
            desc = "精准捕捉每一波行情，择时能力出神入化。你在高点清仓，低点抄底，操作如教科书般完美。群里都在问你的交易策略。";
        } else if (State.stats.luckEvents >= 2) {
            title = "天选之子";
            desc = "运气也是实力的一部分！你总能踩中利好节点。别人追涨杀跌，你躺赢数钱。这就是命，不服不行。";
        } else if (checkBottomFisher()) {
            title = "抄底教父";
            desc = "暴跌中逆势抄底，胆识过人，收获颇丰。当所有人都恐慌割肉时，你微笑着加仓。这种心态，不发财都难。";
        } else if (State.stats.maxDrawdown < 0.2) {
            title = "稳健大师";
            desc = "收益惊人且回撤极小，风控能力一流。你的资金曲线平滑上升，量化基金都想挖你去做首席投资官。";
        } else {
            title = "交易天才";
            desc = "七天内资产翻倍，天赋异禀的交易选手。不管是技术分析还是直觉判断，你都展现出了超越常人的市场嗅觉。";
        }
    }
    // ========== 第3层：优秀表现（ROI > 50%） ==========
    else if (roi > 50) {
        if (State.stats.timingScore >= 70) {
            title = "择时高手";
            desc = "对市场节奏把握出色，进退有据。你知道什么时候该贪婪，什么时候该恐惧。这套操作，值得写进交易笔记。";
        } else if (State.stats.changeCount <= 2) {
            title = "钻石之手";
            desc = "HODL即信仰！拿住不动，收益丰厚。短期波动在你眼中全是噪音，你只相信长期价值。真正的信仰者。";
        } else if (State.minTotalReached < 500) {
            title = "逆转之王";
            desc = "曾经深度亏损，但最终实现大逆转！从ICU到KTV，你演绎了绝地反击的经典剧本。这种心理素质，佩服。";
        } else if (State.stats.luckEvents >= 2) {
            title = "福星高照";
            desc = "运气不错，多次利好事件助你盈利。虽然实力也很重要，但运气确实是实力的一部分。继续保持这个幸运buff！";
        } else {
            title = "盈利达人";
            desc = "稳定的盈利能力，七天内收获50%+收益。不追求暴富，只求稳定增长。这才是成熟交易者的样子。";
        }
    }
    // ========== 第4层：良好表现（ROI > 20%） ==========
    else if (roi > 20) {
        if (State.stats.timingScore >= 60) {
            title = "聪明钱";
            desc = "大部分操作都在正确的时间，赚到了钱。你像机构一样思考，像散户一样行动。这种反差，反而让你获利了。";
        } else if (State.stats.changeCount <= 3) {
            title = "长期主义";
            desc = "不频繁操作，坚持持有，获得了稳定回报。你懂得时间复利的魔力，在浮躁的币圈保持冷静。很难得。";
        } else if (State.stats.luckEvents >= 2) {
            title = "幸运儿";
            desc = "运气尚可，抓住了一些机会。虽然不是每次都对，但关键时刻总能踩中节点。继续保持这个好运！";
        } else {
            title = "稳健收益";
            desc = "不贪不躁，七天内获得正收益，值得称赞。在狂暴的币圈，能稳定赚钱已经超越了90%的人。继续保持。";
        }
    }
    // ========== 第5层：小幅盈利（0% < ROI <= 20%） ==========
    else if (roi > 0) {
        if (State.stats.avgAlpha < 0.1) {
            title = "佛系玩家";
            desc = "仓位很轻，但好在没亏，小赚也是赚。你用最低风险参与了这场狂欢，心态平和如老僧。也许这才是正确的打开方式。";
        } else if (State.minTotalReached < 600) {
            title = "惊险回本";
            desc = "曾在危险边缘徘徊，最终惊险上岸。从亏损到回本，你的心跳像坐过山车。虽然没赚大钱，但至少没被埋。";
        } else if (State.stats.changeCount > 8) {
            title = "忙碌的蜜蜂";
            desc = "频繁操作，最后总算没白忙活。一顿操作猛如虎，一看收益两块五。但至少是正的，对吧？";
        } else {
            title = "小有盈利";
            desc = "虽然收益不多，但赚钱总比亏钱强。在币圈能保住本金还略有盈余，已经证明你的实力了。继续加油！";
        }
    }
    // ========== 第6层：小幅亏损（-20% < ROI <= 0%） ==========
    else if (roi > -20) {
        if (State.stats.avgAlpha < 0.1) {
            title = "观察者模式";
            desc = "全程空仓观望，成功避开波动（也避开利润）。你像个狙击手一样趴在草丛里，但目标一直没出现。下次别怂，干就完了。";
        } else if (State.stats.changeCount <= 1) {
            title = "躺平选手";
            desc = "买了就不动，最后小亏一笔，下次记得看盘。你的操作策略简单粗暴：买定离手。可惜市场不奖励懒惰。";
        } else if (State.stats.timingScore < 40) {
            title = "时机未到";
            desc = "操作节奏有点乱，但亏得不算多。你试图择时，但总踩不准点。别灰心，时机这东西，谁也说不准。";
        } else {
            title = "学费已交";
            desc = "小亏当交学费，积累经验下次再战。这笔钱交得值，至少你学会了市场的残酷。下次归来，你将更强。";
        }
    }
    // ========== 第7层：中度亏损（-50% < ROI <= -20%） ==========
    else if (roi > -50) {
        if (State.stats.timingScore < 35) {
            title = "精准反向师";
            desc = "每次操作都完美避开正确答案，反向指标教科书。如果交易所推出'反向跟单'功能，你一定是收益最高的策略。";
        } else if (State.stats.changeCount > 8) {
            title = "瞎忙活";
            desc = "频繁操作，越操作越亏，不如不动。你的交易次数比高频算法还多，但收益...emmm，至少你为交易所贡献了手续费。";
        } else if (State.stats.allIns >= 2) {
            title = "冲动是魔鬼";
            desc = "多次梭哈最终证明：运气不是实力。你赌对了，但你赌错了次数。梭哈一时爽，爆仓火葬场啊兄弟。";
        } else if (State.stats.panicSells >= 2) {
            title = "恐慌大师";
            desc = "一跌就慌，一慌就卖，卖完就涨。你完美演绎了韭菜的心路历程：割在地板上，站在山顶上。";
        } else {
            title = "割韭菜";
            desc = "被市场反复收割，亏损惨重但未爆仓。你像块韭菜地，割了一茬又一茬。至少还活着，还能再战。";
        }
    }
    // ========== 第8层：重度亏损（ROI <= -50%） ==========
    else if (roi > -80) {
        if (State.stats.avgAlpha > 0.6) {
            title = "钻石大腚";
            desc = "越跌越买，死扛不止，亏得只剩底裤。别人是钻石手，你是钻石腚——死坐不动的意思。补仓补成了股东，套牢套成了信仰。";
        } else if (State.stats.contraryActions >= 3) {
            title = "反向交易员";
            desc = "总和市场对着干，结果可想而知。你觉得自己是逆向投资者，其实只是单纯的方向反了。下次试着跟随趋势？";
        } else {
            title = "重度亏损";
            desc = "亏损超过50%，这个游戏可能不适合你。也许你更适合定投指数基金？币圈太残酷，保重。";
        }
    }
    // ========== 第9层：极端亏损（ROI <= -80%） ==========
    else {
        if (State.amount > 0 && roi < -90) {
            title = "空气币收藏家";
            desc = "亏损90%还不止损，你是在收藏空气吗？别人囤币，你囤亏损。这种执着，用错地方了。下次记得止损是种美德。";
        } else if (State.stats.allIns >= 1) {
            title = "天台排队";
            desc = "梭哈梭哈，最后梭哈到了天台上。All-in一时爽，全家火葬场。天台风大，记得穿外套，排队的人很多。";
        } else {
            title = "几乎归零";
            desc = "资产缩水80%以上，惨不忍睹。从1000U到几百U，你用实际行动证明了：江山易改，本性难移，亏损本色。";
        }
    }
    
    // 如果爆仓，显示墓碑效果
    if (isBankrupt) {
        document.querySelector('.bg-slate-900').classList.add('bg-gray-900');
        document.querySelector('.border-white').classList.add('border-gray-600');
        
        // 添加墓碑图标
        const tombstone = document.createElement('div');
        tombstone.innerHTML = '⚰️';
        tombstone.className = 'text-6xl mb-4';
        document.querySelector('#end-screen .w-full').insertBefore(tombstone, document.querySelector('#end-screen h2'));
    }
    
    document.getElementById('player-title').innerText = title;
    document.getElementById('flavor-text').innerText = desc;
}

// 检查是否为抄底教父
function checkBottomFisher() {
    for (let i = 0; i < State.eventHistory.length; i++) {
        const event = State.eventHistory[i];
        const alpha = State.alphaHistory[i] || 0;
        
        // 检查是否在大跌日(R < -40%)进行大幅买入(alpha > 0.8)
        if (event.event.changePercent < -40 && alpha > 0.8) {
            return true;
        }
    }
    return false;
}

// Init - 确保DOM完全加载后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}