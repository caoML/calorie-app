const { request } = require('../../utils/request')
const { getMealName } = require('../../utils/util')

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    rangeOptions: [
      { days: 7, label: '近7天' },
      { days: 30, label: '近30天' }
    ],
    days: 30,
    dailyTarget: 1800,
    summary: { days: 0, avg: 0, total: 0 },
    list: [],
    loading: true,
    expandedDate: '',   // 当前展开的日期
    detailMap: {},      // date -> { meals: [...] } 当天明细缓存
    // 趋势图
    chart: [],          // 柱状图数据（旧→新）
    targetBottom: 0,    // 目标参考线距底部的像素（rpx）
    selectedDate: '',   // 趋势图当前选中的柱子
    selectedBar: null,  // 选中柱子的信息
    // 餐次分布
    mealStats: [],      // [{meal, name, total, percent, color}]
    weekCompare: null   // {thisWeekAvg, lastWeekAvg, diff}
  },

  // 趋势图轨道高度 / 标签高度（rpx）
  TRACK_H: 240,
  LABEL_H: 40,

  onShow() {
    this.loadTarget()
    this.loadHistory()
    this.loadMealStats()
  },

  // 切换时间区间
  onRangeChange(e) {
    const days = Number(e.currentTarget.dataset.days)
    if (days === this.data.days) return
    this.setData({ days, expandedDate: '' }, () => {
      this.loadHistory()
      this.loadMealStats()
    })
  },

  // 加载用户目标热量
  async loadTarget() {
    try {
      const res = await request('/user/profile', 'GET')
      if (res.code === 0 && res.data && res.data.dailyTarget) {
        this.setData({ dailyTarget: res.data.dailyTarget })
        this.decorateList()
      }
    } catch (e) {
      console.log('loadTarget error:', e)
    }
  },

  // 加载历史汇总
  async loadHistory() {
    this.setData({ loading: true })
    try {
      const res = await request(`/records/history?days=${this.data.days}`, 'GET')
      if (res.code === 0 && res.data) {
        this.setData({
          summary: res.data.summary || { days: 0, avg: 0, total: 0 },
          list: res.data.list || []
        }, () => this.decorateList())
      }
    } catch (e) {
      console.log('loadHistory error:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载餐次分布统计
  async loadMealStats() {
    try {
      const res = await request(`/records/meal-stats?days=${this.data.days}`, 'GET')
      if (res.code === 0 && res.data) {
        const { mealDistribution, weekCompare } = res.data
        const mealNames = {
          breakfast: { name: '早餐', color: '#FFB74D' },
          lunch: { name: '午餐', color: '#81C784' },
          dinner: { name: '晚餐', color: '#64B5F6' },
          snack: { name: '加餐', color: '#CE93D8' }
        }
        const totalKcal = mealDistribution.reduce((sum, m) => sum + m.total, 0) || 1
        const mealStats = ['breakfast', 'lunch', 'dinner', 'snack']
          .map(key => {
            const found = mealDistribution.find(m => m.meal === key)
            const total = found ? found.total : 0
            const info = mealNames[key]
            return {
              meal: key,
              name: info.name,
              color: info.color,
              total,
              percent: Math.round((total / totalKcal) * 100)
            }
          })
          .filter(m => m.total > 0)

        this.setData({ mealStats, weekCompare })
      }
    } catch (e) {
      console.log('loadMealStats error:', e)
    }
  },

  // 给列表补充展示字段（日期文字、进度、是否超标）
  decorateList() {
    const target = this.data.dailyTarget || 1800
    const list = this.data.list.map(item => {
      const { md, week, isToday } = this.formatDay(item.date)
      const percent = target > 0 ? Math.round((item.total / target) * 100) : 0
      return {
        ...item,
        md,
        week,
        isToday,
        percent,
        barWidth: Math.min(percent, 100),
        over: item.total > target
      }
    })

    // 趋势图：list 是 DESC（新→旧），图表需旧→新
    const asc = [...list].reverse()
    const maxTotal = asc.reduce((m, it) => Math.max(m, it.total), 0)
    const maxVal = Math.max(maxTotal, target) || 1
    const chart = asc.map(it => ({
      date: it.date,
      total: it.total,
      md: it.md,
      week: it.week,
      isToday: it.isToday,
      percent: it.percent,
      over: it.over,
      d: String(Number(it.date.split('-')[2])), // 几号
      barH: Math.max(Math.round((this.TRACK_H * it.total) / maxVal), 4)
    }))
    const targetBottom = this.LABEL_H + Math.round((this.TRACK_H * target) / maxVal)

    // 保持已选中的柱子，否则默认选最新一天
    let selectedDate = this.data.selectedDate
    if (!chart.find(c => c.date === selectedDate)) {
      selectedDate = chart.length ? chart[chart.length - 1].date : ''
    }
    const selectedBar = chart.find(c => c.date === selectedDate) || null

    this.setData({ list, chart, targetBottom, selectedDate, selectedBar })
  },

  // 点击趋势图柱子
  onSelectBar(e) {
    const date = e.currentTarget.dataset.date
    const bar = this.data.chart.find(c => c.date === date)
    if (bar) this.setData({ selectedDate: date, selectedBar: bar })
  },

  // 'YYYY-MM-DD' -> { md, week, isToday }
  formatDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const now = new Date()
    const isToday = y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate()
    return {
      md: `${m}月${d}日`,
      week: `周${WEEK[dt.getDay()]}`,
      isToday
    }
  },

  // 点击某天，展开/收起当天明细
  async onToggleDay(e) {
    const date = e.currentTarget.dataset.date
    if (this.data.expandedDate === date) {
      this.setData({ expandedDate: '' })
      return
    }
    // 已缓存直接展开
    if (this.data.detailMap[date]) {
      this.setData({ expandedDate: date })
      return
    }
    try {
      const res = await request(`/records?date=${date}`, 'GET')
      if (res.code === 0) {
        const records = (res.data && res.data.records) || []
        const meals = this.groupByMeal(records)
        this.setData({
          [`detailMap.${date}`]: { meals },
          expandedDate: date
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 按餐次分组
  groupByMeal(records) {
    const order = ['breakfast', 'lunch', 'dinner', 'snack']
    const map = {}
    records.forEach(r => {
      if (!map[r.meal]) map[r.meal] = { meal: r.meal, name: getMealName(r.meal), total: 0, items: [] }
      map[r.meal].items.push(r)
      map[r.meal].total += r.kcal
    })
    return order.filter(k => map[k]).map(k => ({
      ...map[k],
      total: Math.round(map[k].total)
    }))
  }
})
