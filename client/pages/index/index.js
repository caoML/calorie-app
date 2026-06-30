const { request } = require('../../utils/request')
const { getDefaultMeal, getMealName, formatDate } = require('../../utils/util')

Page({
  data: {
    todayStr: '',
    todayTotal: 0,
    dailyTarget: 1800,
    remaining: 1800,
    streak: 0,
    recentFoods: [],
    quickFoods: [],
    mealTemplates: [],
    meals: [
      { key: 'breakfast', name: '🌅 早餐', total: 0, records: [] },
      { key: 'lunch', name: '☀️ 午餐', total: 0, records: [] },
      { key: 'dinner', name: '🌙 晚餐', total: 0, records: [] },
      { key: 'snack', name: '🍪 加餐', total: 0, records: [] }
    ],
    showRecordModal: false,
    selectedFood: null,
    monsterLevel: 0,
    // 运动相关
    showExerciseModal: false,
    showExerciseDetail: false,
    exerciseRecords: [],
    exerciseBurned: 0,
    netIntake: 0,
    // 飞数动效
    flyNumbers: [],
    flyNumberId: 0,
    // 怪兽喊饿 & 打卡激励
    monsterHungry: false,
    hungryMessage: '',
    // 营养均衡提示
    nutritionTip: null
  },

  onLoad() {
    this.setData({
      todayStr: this.getDateStr()
    })
  },

  onShow() {
    this.loadTodayData(true) // true = 首次/回到页面，AI分析立即执行
    this.loadRecentFoods()
    this.loadUserTarget()
    this.loadQuickFoods()
    this.loadMealTemplates()
    this.loadExerciseData()
    this.checkMonsterHungry()
  },

  // 获取今日日期文字
  getDateStr() {
    const now = new Date()
    const weekMap = ['日', '一', '二', '三', '四', '五', '六']
    const month = now.getMonth() + 1
    const day = now.getDate()
    const week = weekMap[now.getDay()]
    return `${month}月${day}日 周${week}`
  },

  // 加载用户目标热量
  async loadUserTarget() {
    try {
      const res = await request('/user/profile', 'GET')
      if (res.code === 0 && res.data) {
        const target = res.data.dailyTarget || 1800
        const current = this.data.netIntake > 0 ? this.data.netIntake : this.data.todayTotal
        this.setData({
          dailyTarget: target,
          remaining: target - current
        })
      }
    } catch (e) {
      console.log('loadUserTarget error:', e)
    }
  },

  // 加载今日记录
  // immediate: true=立即AI分析（onShow），false/undefined=防抖延迟分析（记录变更后）
  async loadTodayData(immediate) {
    try {
      const today = formatDate(new Date())
      const res = await request(`/records?date=${today}`, 'GET')
      if (res.code === 0) {
        const records = res.data.records || []
        let todayTotal = 0
        const meals = [
          { key: 'breakfast', name: '🌅 早餐', total: 0, records: [] },
          { key: 'lunch', name: '☀️ 午餐', total: 0, records: [] },
          { key: 'dinner', name: '🌙 晚餐', total: 0, records: [] },
          { key: 'snack', name: '🍪 加餐', total: 0, records: [] }
        ]

        records.forEach(record => {
          todayTotal += record.kcal
          const mealIndex = meals.findIndex(m => m.key === record.meal)
          if (mealIndex > -1) {
            meals[mealIndex].records.push(record)
            meals[mealIndex].total += record.kcal
          }
        })

        // 净摄入 = 摄入 - 运动消耗（抵扣上限：最多抵消摄入的30%）
        const maxDeduction = todayTotal * 0.3
        const actualDeduction = Math.min(this.data.exerciseBurned, maxDeduction)
        const netIntake = Math.round(todayTotal - actualDeduction)

        this.setData({
          todayTotal,
          netIntake,
          remaining: this.data.dailyTarget - netIntake,
          meals,
          streak: res.data.streak || 0
        })
        // 数据加载完毕后再检测喊饿 & 营养提示
        this.checkMonsterHungry()
        this.analyzeNutrition(immediate)
      }
    } catch (e) {
      console.log('loadTodayData error:', e)
    }
  },

  // 加载最近吃过的食物
  async loadRecentFoods() {
    try {
      const res = await request('/records/recent-foods', 'GET')
      if (res.code === 0) {
        this.setData({ recentFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadRecentFoods error:', e)
    }
  },

  // 加载快捷食物列表
  async loadQuickFoods() {
    try {
      const res = await request('/quick-foods', 'GET')
      if (res.code === 0) {
        this.setData({ quickFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadQuickFoods error:', e)
    }
  },

  // 加载餐食模板
  async loadMealTemplates() {
    try {
      const res = await request('/meal-templates', 'GET')
      if (res.code === 0) {
        this.setData({ mealTemplates: res.data || [] })
      }
    } catch (e) {
      console.log('loadMealTemplates error:', e)
    }
  },

  // 跳转搜索页
  goToSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  // ====== 快捷记录 ======
  // 点击快捷按钮直接记录
  async onQuickRecord(e) {
    const item = e.currentTarget.dataset.item
    const meal = getDefaultMeal() // 根据当前时间自动判断餐次

    try {
      const res = await request('/records', 'POST', {
        foodName: item.foodName,
        foodId: item.foodId || null,
        amount: item.amount,
        unit: item.unit,
        meal,
        kcal: item.kcal,
        date: formatDate(new Date())
      })
      if (res.code === 0) {
        this.showFlyNumber(item.kcal)
        this.loadTodayData()
      }
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // 长按快捷按钮（删除/编辑）
  onQuickItemLongPress(e) {
    const item = e.currentTarget.dataset.item
    wx.showActionSheet({
      itemList: ['删除此快捷按钮'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/quick-foods/${item.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadQuickFoods()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 编辑快捷食物
  onEditQuickFoods() {
    wx.navigateTo({ url: '/pages/quick-foods/quick-foods' })
  },

  // ====== 餐食模板 ======
  // 使用模板一键记录
  async onUseTemplate(e) {
    const template = e.currentTarget.dataset.template
    const meal = template.defaultMeal || getDefaultMeal()

    wx.showModal({
      title: `记录「${template.name}」`,
      content: `包含${template.items.length}种食物，共${template.totalKcal}大卡\n记录到: ${getMealName(meal)}`,
      confirmText: '确认记录',
      success: async (modalRes) => {
        if (modalRes.confirm) {
          try {
            // 先调用模板使用接口（增加使用次数）
            await request(`/meal-templates/${template.id}/use`, 'POST')
            
            // 批量记录
            const records = template.items.map(item => ({
              foodName: item.foodName,
              foodId: item.foodId || null,
              amount: item.amount,
              unit: item.unit,
              kcal: item.kcal,
              meal,
              date: formatDate(new Date())
            }))
            
            const res = await request('/records/batch', 'POST', { records })
            if (res.code === 0) {
              wx.showToast({ title: '记录成功', icon: 'success' })
              this.loadTodayData()
            }
          } catch (e) {
            wx.showToast({ title: '记录失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 管理模板
  goToTemplateManage() {
    wx.navigateTo({ url: '/pages/meal-templates/meal-templates' })
  },

  // 将某一餐保存为模板
  onSaveAsTemplate(e) {
    const meal = e.currentTarget.dataset.meal
    if (meal.records.length < 2) return

    wx.showModal({
      title: '保存为常吃模板',
      content: `将「${meal.name}」的${meal.records.length}项食物保存为模板，下次可一键记录`,
      editable: true,
      placeholderText: '模板名称（如：工作日午餐）',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            const saveRes = await request('/meal-templates/from-records', 'POST', {
              name: res.content,
              meal: meal.key,
              records: meal.records
            })
            if (saveRes.code === 0) {
              wx.showToast({ title: '保存成功', icon: 'success' })
              this.loadMealTemplates()
            }
          } catch (e) {
            wx.showToast({ title: '保存失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ====== 最近吃过 / 记录弹窗 ======
  // 点击最近吃过的食物
  onRecentFoodTap(e) {
    const food = e.currentTarget.dataset.food
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // 记录确认
  async onRecordConfirm(e) {
    const { food, amount, unit, meal, kcal, sharePeople, shareRatio } = e.detail
    try {
      const res = await request('/records', 'POST', {
        foodName: food.name,
        foodId: food.id,
        amount,
        unit,
        meal: meal || getDefaultMeal(),
        kcal,
        sharePeople: sharePeople || 1,
        shareRatio: shareRatio || 'equal',
        date: formatDate(new Date())
      })
      if (res.code === 0) {
        this.setData({ showRecordModal: false })
        this.showFlyNumber(kcal)
        this.loadTodayData()
      }
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // 关闭记录弹窗
  onRecordModalClose() {
    this.setData({ showRecordModal: false })
  },

  // 长按记录项（删除/清空）
  onRecordLongPress(e) {
    const record = e.currentTarget.dataset.record
    wx.showActionSheet({
      itemList: ['删除此记录', '清空今日全部记录'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/records/${record.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          this.clearTodayRecords()
        }
      }
    })
  },

  // 清空今日全部记录
  clearTodayRecords() {
    wx.showModal({
      title: '确认清空',
      content: '将删除今天的全部饮食记录，不可恢复',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 逐条删除今天的所有记录
            const allRecords = []
            this.data.meals.forEach(meal => {
              meal.records.forEach(r => allRecords.push(r))
            })
            await Promise.all(allRecords.map(r => request(`/records/${r.id}`, 'DELETE')))
            wx.showToast({ title: '已清空', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '清空失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ====== 左滑操作 ======
  onSwipeStart(e) {
    this._swipeStartX = e.touches[0].clientX
    this._swipeStartY = e.touches[0].clientY
    this._swiping = false
  },

  onSwipeMove(e) {
    const diffX = e.touches[0].clientX - this._swipeStartX
    const diffY = e.touches[0].clientY - this._swipeStartY

    // 如果纵向移动更多，不处理
    if (Math.abs(diffY) > Math.abs(diffX)) return

    if (diffX < -30) {
      this._swiping = true
      const recordId = e.currentTarget.dataset.recordId
      const mealKey = e.currentTarget.dataset.mealKey
      this._swipeRecordId = recordId
      this._swipeMealKey = mealKey
    }
  },

  onSwipeEnd(e) {
    if (!this._swiping) return
    this._swiping = false

    const recordId = this._swipeRecordId
    const mealKey = this._swipeMealKey

    // 标记该记录为已滑开状态
    const meals = this.data.meals.map(meal => {
      if (meal.key === mealKey) {
        return {
          ...meal,
          records: meal.records.map(r => ({
            ...r,
            _swiped: r.id === recordId ? !r._swiped : false
          }))
        }
      }
      return {
        ...meal,
        records: meal.records.map(r => ({ ...r, _swiped: false }))
      }
    })
    this.setData({ meals })
  },

  // 删除记录（左滑）
  async onDeleteRecord(e) {
    const record = e.currentTarget.dataset.record
    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.foodName}」？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request(`/records/${record.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 编辑记录（左滑）— 打开记录弹窗预填数据
  onEditRecord(e) {
    const record = e.currentTarget.dataset.record
    // 构造一个 food 对象传给 record-modal
    const food = {
      id: record.foodId,
      name: record.foodName,
      kcalPer100g: record.kcal, // 用于显示
      customKcal: record.kcal, // 直接使用原来的热量
      _editMode: true,
      _recordId: record.id,
      _originalRecord: record
    }
    this.setData({
      selectedFood: food,
      showRecordModal: true
    })
  },

  // ====== 怪兽喊饿 & 打卡激励 ======
  // 检测是否该提醒用户记录
  checkMonsterHungry() {
    const hour = new Date().getHours()
    const meals = this.data.meals
    let monsterHungry = false
    let hungryMessage = ''

    // 早上10点后还没记早餐
    if (hour >= 10 && hour < 14) {
      const breakfast = meals.find(m => m.key === 'breakfast')
      if (breakfast && breakfast.records.length === 0) {
        monsterHungry = true
        hungryMessage = '早餐还没记呢，补一下吧~'
      }
    }
    // 下午14点后还没记午餐
    if (hour >= 14 && hour < 18) {
      const lunch = meals.find(m => m.key === 'lunch')
      if (lunch && lunch.records.length === 0) {
        monsterHungry = true
        hungryMessage = '午饭吃了吗？记一下吧~'
      }
    }
    // 晚上20点后还没记晚餐
    if (hour >= 20) {
      const dinner = meals.find(m => m.key === 'dinner')
      if (dinner && dinner.records.length === 0) {
        monsterHungry = true
        hungryMessage = '晚饭还没记录，别忘了哦~'
      }
    }
    // 今天完全没记录
    if (this.data.todayTotal === 0 && hour >= 12) {
      monsterHungry = true
      hungryMessage = '今天还没开始记录，快来喂我吧！'
    }

    this.setData({ monsterHungry, hungryMessage })
  },

  // ====== 营养均衡提示（AI 分析 + 本地降级） ======
  // 防抖入口：连续操作时不频繁调 AI，停下来 3 秒后才分析
  analyzeNutrition(immediate) {
    // immediate = true 时立即执行（如 onShow 回到首页）
    if (this._nutritionTimer) {
      clearTimeout(this._nutritionTimer)
      this._nutritionTimer = null
    }

    if (immediate) {
      this._doAnalyzeNutrition()
    } else {
      // 防抖 3 秒：用户连续记录时不会每条都调 AI
      this._nutritionTimer = setTimeout(() => {
        this._nutritionTimer = null
        this._doAnalyzeNutrition()
      }, 3000)
    }
  },

  async _doAnalyzeNutrition() {
    const { meals, todayTotal, dailyTarget, exerciseBurned } = this.data
    const hour = new Date().getHours()

    // 至少记录了一餐才给建议
    const recordedMeals = meals.filter(m => m.records.length > 0)
    if (recordedMeals.length === 0 || todayTotal === 0) {
      this.setData({ nutritionTip: null })
      return
    }

    // 构造饮食数据摘要
    const mealData = meals.map(m => ({
      name: m.name.replace(/[^\u4e00-\u9fa5]/g, ''), // 去掉 emoji
      kcal: m.total,
      foods: m.records.map(r => r.foodName)
    }))

    // 生成数据指纹，避免数据没变时重复调用 AI
    const dataFingerprint = JSON.stringify({ mealData, todayTotal, dailyTarget })
    if (this._lastNutritionFingerprint === dataFingerprint && this.data.nutritionTip) {
      return // 数据没变，跳过
    }
    this._lastNutritionFingerprint = dataFingerprint

    // 总记录数少于 2 条时，用本地规则就够了，不浪费 AI
    const totalRecords = meals.reduce((sum, m) => sum + m.records.length, 0)
    if (totalRecords < 2) {
      this.fallbackNutritionAnalysis()
      return
    }

    // 调 AI 分析
    try {
      const res = await request('/ai-estimate/nutrition', 'POST', {
        meals: mealData,
        todayTotal,
        dailyTarget,
        exerciseBurned: exerciseBurned || 0,
        hour
      })

      if (res.code === 0 && res.data) {
        this.setData({ nutritionTip: res.data })
        return
      }
    } catch (e) {
      console.log('AI nutrition analysis error:', e)
    }

    // AI 失败，降级到本地简易规则
    this.fallbackNutritionAnalysis()
  },

  // 本地降级营养分析（AI 不可用时使用）
  fallbackNutritionAnalysis() {
    const { meals, todayTotal, dailyTarget } = this.data
    const hour = new Date().getHours()
    let tip = null

    const bfKcal = meals.find(m => m.key === 'breakfast')?.total || 0
    const dinnerKcal = meals.find(m => m.key === 'dinner')?.total || 0
    const snackKcal = meals.find(m => m.key === 'snack')?.total || 0

    if (hour >= 12 && bfKcal > 0 && bfKcal < todayTotal * 0.15) {
      tip = { icon: '🥣', title: '早餐偏少', desc: '早餐建议占全天25-30%，明天可以适当丰富一下~' }
    } else if (hour >= 20 && dinnerKcal > todayTotal * 0.45) {
      tip = { icon: '🌙', title: '晚餐偏重', desc: '晚餐热量占比偏高，建议把部分热量分配到午餐' }
    } else if (snackKcal > todayTotal * 0.25 && snackKcal > 300) {
      tip = { icon: '🍪', title: '零食稍多', desc: '加餐热量偏高，可以选择水果或坚果替代~' }
    } else if (hour < 18 && dinnerKcal === 0) {
      const remaining = dailyTarget - todayTotal
      if (remaining > 0 && remaining < dailyTarget * 0.25) {
        tip = { icon: '💡', title: '预算紧张', desc: `晚餐还剩 ${remaining} 大卡，建议选择轻食哦~` }
      }
    }

    this.setData({ nutritionTip: tip })
  },

  // 点击连续打卡徽章 - 展示打卡详情
  showStreakDetail() {
    const streak = this.data.streak
    let title = '🔥 连续打卡'
    let content = ''

    if (streak >= 30) {
      content = `太厉害了！连续记录${streak}天！\n你已经是自律达人了 💪`
    } else if (streak >= 14) {
      content = `坚持${streak}天了，很棒！\n继续保持，习惯已经养成 🎯`
    } else if (streak >= 7) {
      content = `连续${streak}天，一周达成！\n坚持就是胜利 ⭐`
    } else if (streak >= 3) {
      content = `已连续${streak}天，不错哦~\n再坚持几天养成习惯！`
    } else {
      content = `连续${streak}天，好的开始！\n每天记一记，轻松又健康~`
    }

    wx.showModal({
      title,
      content,
      showCancel: false,
      confirmText: '继续加油'
    })
  },

  // ====== 飞数动效 ======
  // 显示热量飞数动画（先滚回顶部让用户看到怪兽反馈）
  showFlyNumber(kcal) {
    // 先滚动到顶部，确保怪兽卡片可见
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 200
    })

    // 稍微延迟后再播放飞数，等滚动到位
    setTimeout(() => {
      const id = this.data.flyNumberId + 1
      const prefix = kcal >= 0 ? '+' : ''
      const flyItem = { id, kcal: `${prefix}${kcal}`, animating: true, isExercise: kcal < 0 }
      const flyNumbers = [...this.data.flyNumbers, flyItem]

      this.setData({ flyNumbers, flyNumberId: id })

      // 动画结束后移除
      setTimeout(() => {
        const updated = this.data.flyNumbers.filter(item => item.id !== id)
        this.setData({ flyNumbers: updated })
      }, 1200)
    }, 250)
  },



  // ====== 怪兽交互 ======
  // 怪兽档位变化 → 背景联动
  onMonsterLevelChange(e) {
    const { level } = e.detail
    this.setData({ monsterLevel: level })
  },

  // 点击怪兽
  onMonsterTap() {
    const current = this.data.netIntake > 0 ? this.data.netIntake : this.data.todayTotal
    const percent = this.data.dailyTarget > 0
      ? Math.round((current / this.data.dailyTarget) * 100)
      : 0

    // 随机回复一句
    const responses = this.getMonsterTapResponses(percent)
    const randomMsg = responses[Math.floor(Math.random() * responses.length)]

    wx.showToast({
      title: randomMsg,
      icon: 'none',
      duration: 2000
    })
  },

  // 根据当前状态获取点击怪兽的随机回复（上限模式：吃得少=开心）
  getMonsterTapResponses(percent) {
    if (percent < 20) {
      return ['今天状态满分！✨', '零负担，感觉超棒！', '继续保持轻盈~']
    }
    if (percent < 40) {
      return ['控制得真好！💪', '自律的人最帅了', '今天预算还很充裕~']
    }
    if (percent < 60) {
      return ['还不错，稳住~', '节奏刚刚好', '预算还很富裕呢']
    }
    if (percent < 80) {
      return ['正常正常，别有压力', '一天三餐都在计划内', '稳住就是胜利~']
    }
    if (percent < 95) {
      return ['预算快用完了，注意哦', '后面少吃点~', '快到上限了！']
    }
    if (percent <= 115) {
      return ['到上限了...管住嘴！', '超了一点，问题不大', '今天就到这里吧']
    }
    return ['我要炸了！！！', '今天放飞自我了...', '明天一定要补回来！']
  },

  // ====== 运动记录 ======
  // 加载今日运动数据
  async loadExerciseData() {
    try {
      const today = formatDate(new Date())
      const res = await request(`/exercises?date=${today}`, 'GET')
      if (res.code === 0) {
        const exerciseRecords = res.data.records || []
        const exerciseBurned = res.data.totalBurned || 0
        this.setData({ exerciseRecords, exerciseBurned })
        // 重新计算净摄入和剩余
        this.recalcNetIntake()
      }
    } catch (e) {
      console.log('loadExerciseData error:', e)
    }
  },

  // 重新计算净摄入
  recalcNetIntake() {
    const { todayTotal, exerciseBurned, dailyTarget } = this.data
    // 抵扣上限：最多抵消摄入的30%
    const maxDeduction = todayTotal * 0.3
    const actualDeduction = Math.min(exerciseBurned, maxDeduction)
    const netIntake = Math.round(todayTotal - actualDeduction)
    this.setData({
      netIntake,
      remaining: dailyTarget - netIntake
    })
  },

  // 打开运动记录弹窗
  // 展开/收起运动明细
  toggleExerciseDetail() {
    this.setData({ showExerciseDetail: !this.data.showExerciseDetail })
  },

  openExerciseModal() {
    this.setData({ showExerciseModal: true })
  },

  // 关闭运动记录弹窗
  onExerciseModalClose() {
    this.setData({ showExerciseModal: false })
  },

  // 运动记录确认
  async onExerciseConfirm(e) {
    const { exerciseName, icon, duration, kcalBurned } = e.detail
    try {
      const res = await request('/exercises', 'POST', {
        exerciseName,
        icon,
        duration,
        kcalBurned,
        date: formatDate(new Date())
      })
      if (res.code === 0) {
        this.setData({ showExerciseModal: false })
        wx.showToast({ title: `消耗 ${kcalBurned} 大卡 🏃`, icon: 'none', duration: 2000 })
        // 先加载数据（确保"运动消耗"数字已渲染），再播飞数动效
        await Promise.all([this.loadExerciseData(), this.loadTodayData()])
        this.showFlyNumber(-kcalBurned)
      }
    } catch (e) {
      wx.showToast({ title: '记录失败', icon: 'none' })
    }
  },

  // 长按运动记录（删除）
  onExerciseLongPress(e) {
    const record = e.currentTarget.dataset.record
    wx.showActionSheet({
      itemList: ['删除此运动记录'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await request(`/exercises/${record.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadExerciseData()
            this.loadTodayData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
