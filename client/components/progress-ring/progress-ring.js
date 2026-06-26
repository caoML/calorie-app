Component({
  properties: {
    current: { type: Number, value: 0 },
    target: { type: Number, value: 1800 },
    size: { type: Number, value: 180 }
  },

  data: {
    percent: 0
  },

  observers: {
    'current, target': function(current, target) {
      const percent = target > 0 ? Math.min(Math.round(current / target * 100), 999) : 0
      this.setData({ percent })
      this.drawRing(percent)
    }
  },

  lifetimes: {
    ready() {
      this.drawRing(this.data.percent)
    }
  },

  methods: {
    drawRing(percent) {
      const query = this.createSelectorQuery()
      query.select('#progressRing').boundingClientRect((rect) => {
        if (!rect) return
        
        const ctx = wx.createCanvasContext('progressRing', this)
        const width = rect.width
        const height = rect.height
        const centerX = width / 2
        const centerY = height / 2
        const radius = Math.min(width, height) / 2 - 8
        const lineWidth = 10

        // 清空画布
        ctx.clearRect(0, 0, width, height)

        // 背景圆环
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.setStrokeStyle('rgba(198, 242, 78, 0.16)')
        ctx.setLineWidth(lineWidth)
        ctx.setLineCap('round')
        ctx.stroke()

        // 进度圆环
        if (percent > 0) {
          const startAngle = -Math.PI / 2
          const endAngle = startAngle + (Math.min(percent, 100) / 100) * 2 * Math.PI
          
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, startAngle, endAngle)
          
          // 超过100%变珊瑚红警示，否则亮柠檬绿
          if (percent > 100) {
            ctx.setStrokeStyle('#FF6B5E')
          } else {
            ctx.setStrokeStyle('#C6F24E')
          }
          ctx.setLineWidth(lineWidth)
          ctx.setLineCap('round')
          ctx.stroke()
        }

        ctx.draw()
      }).exec()
    }
  }
})
