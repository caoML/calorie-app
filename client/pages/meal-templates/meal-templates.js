const { request } = require('../../utils/request')

Page({
  data: {
    templates: []
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    try {
      const res = await request('/meal-templates', 'GET')
      if (res.code === 0) {
        this.setData({ templates: res.data || [] })
      }
    } catch (e) {
      console.log('loadData error:', e)
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除这个模板？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request(`/meal-templates/${id}`, 'DELETE')
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
