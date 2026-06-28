/**
 * 卡路里小怪兽组件
 * 7 个档位，根据 todayTotal / dailyTarget 的消耗比例映射体型
 * 
 * 设计理念：dailyTarget 是「热量预算上限」，不是目标
 * 吃得越少 → 怪兽越轻盈精神（好状态）
 * 接近上限 → 怪兽越来越膨胀紧张（警示）
 * 超过上限 → 怪兽要爆炸了（超标）
 * 
 * 档位分布（前 80% 都是正面/中性状态）：
 * 0: 0%~20%    → 超级轻盈，无负担（最好状态）
 * 1: 20%~40%   → 活力满满，状态不错
 * 2: 40%~60%   → 状态不错，正常进食
 * 3: 60%~80%   → 平稳正常，三餐吃得差不多了
 * 4: 80%~95%   → 注意一下，快到上限了
 * 5: 95%~115%  → 快超了/刚超，紧张
 * 6: >115%     → 爆炸，明显超标
 */

// 怪兽台词配置（每个档位多条随机）
const MONSTER_QUOTES = [
  // 0 - 超级轻盈
  [
    '✨ 超级轻盈！今天状态满分~',
    '🌟 好棒！保持得很好哦~',
    '🦋 轻如羽毛，今天超自律！',
    '💫 无负担的一天，真舒服~'
  ],
  // 1 - 活力满满
  [
    '💪 活力满满，控制得很好！',
    '🏃 精力充沛！继续保持~',
    '⚡ 状态拉满，你最棒！',
    '🎯 完美节奏，棒棒的~'
  ],
  // 2 - 状态不错
  [
    '😊 状态不错，预算还很充裕~',
    '👍 吃得刚好，不多不少',
    '🌈 稳稳的幸福，继续~',
    '☀️ 营养均衡，心情也好'
  ],
  // 3 - 平稳正常
  [
    '🙂 正常节奏，稳住就好',
    '📊 三餐差不多了，晚点少吃',
    '🍃 还行，注意控制零食哦',
    '⏰ 预算过半了，后面悠着点'
  ],
  // 4 - 注意一下
  [
    '😐 预算快用完了，注意一下哦',
    '⚠️ 快到上限了，悠着点！',
    '🫣 再吃就超了哦...',
    '🛑 刹车刹车！差不多了'
  ],
  // 5 - 快超了/刚超
  [
    '😰 到上限了！管住嘴！',
    '🚨 超标警告！别再吃了！',
    '😱 我快撑爆了...求你停',
    '💥 危险危险！远离零食！'
  ],
  // 6 - 爆炸
  [
    '🤯 超标了...明天补回来吧',
    '💀 彻底炸了...算了躺平',
    '🫠 我已经...不是我了...',
    '😵‍💫 今天就这样吧，明天重来'
  ]
]

// 怪兽状态名（从轻盈到爆炸）
const MONSTER_STATES = [
  'lightest',    // 0 - 超级轻盈
  'energetic',   // 1 - 活力满满
  'good',        // 2 - 状态不错
  'steady',      // 3 - 平稳正常
  'cautious',    // 4 - 注意一下
  'tense',       // 5 - 快超了/刚超
  'exploding'    // 6 - 爆炸
]

Component({
  properties: {
    // 今日已摄入
    current: {
      type: Number,
      value: 0
    },
    // 每日预算上限
    target: {
      type: Number,
      value: 1800
    }
  },

  data: {
    level: 0,            // 当前档位 0-6
    quote: MONSTER_QUOTES[0][0],
    stateName: MONSTER_STATES[0],
    monsterImageA: '/images/monster/level-0.png',  // 图层A
    monsterImageB: '',                              // 图层B
    imgSwitch: false,    // false=显示A，true=显示B
    percent: 0,          // 预算消耗百分比
    isAnimating: false,  // 档位切换变身动画
    isTapped: false,     // 点击反弹动画
    showBubble: true,    // 气泡显示
    isEntering: true     // 入场动画状态
  },

  observers: {
    'current, target': function (current, target) {
      this.updateMonsterState(current, target)
    }
  },

  lifetimes: {
    attached() {
      this.updateMonsterState(this.data.current, this.data.target)
      // 入场动画：延迟后取消入场状态
      setTimeout(() => {
        this.setData({ isEntering: false })
      }, 800)
    }
  },

  methods: {
    updateMonsterState(current, target) {
      if (target <= 0) target = 1800
      const percent = Math.round((current / target) * 100)
      const level = this.calcLevel(percent)

      // 如果档位没变，只更新百分比（带数字动画）
      if (level === this.data.level && this.data.monsterImageA) {
        this.animatePercent(this.data.percent, percent)
        return
      }

      const newImage = `/images/monster/level-${level}.png`
      const currentSwitch = this.data.imgSwitch

      // 档位变化 → 播放变身动画 + 交叉淡入淡出
      this.setData({
        isAnimating: true,
        showBubble: false
      })

      // 将新图片设置到即将显示的图层，然后切换
      setTimeout(() => {
        const updateData = {
          level,
          percent,
          stateName: MONSTER_STATES[level],
          imgSwitch: !currentSwitch
        }
        // 把新图放到即将淡入的图层
        if (!currentSwitch) {
          updateData.monsterImageB = newImage
        } else {
          updateData.monsterImageA = newImage
        }
        this.setData(updateData)
        // 通知外部当前档位（用于背景联动）
        this.triggerEvent('levelchange', { level })
      }, 150)

      // 变身动画结束后显示随机台词
      setTimeout(() => {
        const quotes = MONSTER_QUOTES[level]
        const quote = quotes[Math.floor(Math.random() * quotes.length)]
        this.setData({
          isAnimating: false,
          quote,
          showBubble: true
        })
      }, 600)
    },

    /**
     * 根据预算消耗百分比计算档位 (0-6)
     * 前 80% 都是正面/中性状态，80% 之后才开始警示
     */
    calcLevel(percent) {
      if (percent < 20) return 0
      if (percent < 40) return 1
      if (percent < 60) return 2
      if (percent < 80) return 3
      if (percent < 95) return 4
      if (percent <= 115) return 5
      return 6
    },

    // 百分比数字递增/递减动画
    animatePercent(from, to) {
      if (from === to) return
      // 清除之前的动画
      if (this._percentTimer) clearInterval(this._percentTimer)
      
      const diff = to - from
      const steps = Math.min(Math.abs(diff), 20) // 最多20步
      const stepValue = diff / steps
      let current = from
      let step = 0

      this._percentTimer = setInterval(() => {
        step++
        if (step >= steps) {
          clearInterval(this._percentTimer)
          this._percentTimer = null
          this.setData({ percent: to })
        } else {
          current += stepValue
          this.setData({ percent: Math.round(current) })
        }
      }, 30)
    },

    // 点击怪兽的彩蛋交互
    onMonsterTap() {
      this.triggerEvent('tap')
      // 点击反弹
      this.setData({ isTapped: true })
      setTimeout(() => {
        this.setData({ isTapped: false })
      }, 400)

      // 连续点击计数
      const now = Date.now()
      if (now - (this._lastTapTime || 0) < 800) {
        this._tapCount = (this._tapCount || 1) + 1
      } else {
        this._tapCount = 1
      }
      this._lastTapTime = now

      // 连续点击彩蛋
      if (this._tapCount >= 5) {
        const easterEggs = [
          '🫠 别戳了别戳了！',
          '😤 再戳我要生气了！',
          '🤪 你是不是太闲了？',
          '🥴 头好晕...别晃了！',
          '😵 停！我投降！',
          '🫨 你手不累吗...'
        ]
        const egg = easterEggs[Math.floor(Math.random() * easterEggs.length)]
        this.setData({ quote: egg, showBubble: true })
        this._tapCount = 0
      }
    }
  }
})
