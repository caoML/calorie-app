const { request } = require('../../utils/request')

Page({
  data: {
    quickFoods: [],
    form: {
      name: '',
      foodName: '',
      amount: '',
      unit: 'g',
      kcal: '',
      icon: '🍚'
    }
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    try {
      const res = await request('/quick-foods', 'GET')
      if (res.code === 0) {
        this.setData({ quickFoods: res.data || [] })
      }
    } catch (e) {
      console.log('loadData error:', e)
    }
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  async onAdd() {
    const { name, foodName, amount, kcal, unit, icon } = this.data.form
    if (!name || !foodName || !amount || !kcal) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    try {
      const res = await request('/quick-foods', 'POST', {
        name,
        foodName,
        amount: Number(amount),
        unit: unit || 'g',
        kcal: Number(kcal),
        icon: icon || '🍚'
      })
      if (res.code === 0) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.setData({
          form: { name: '', foodName: '', amount: '', unit: 'g', kcal: '', icon: '🍚' }
        })
        this.loadData()
      }
    } catch (e) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  async onDelete(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: '确认删除',
      content: `删除快捷按钮「${item.name}」？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await request(`/quick-foods/${item.id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  onLongPress(e) {
    // 后续可以做拖拽排序
    wx.showToast({ title: '长按排序开发中', icon: 'none' })
  }
})
