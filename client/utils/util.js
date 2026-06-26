/**
 * 工具函数
 */

// kJ 转换为 kcal
function kjToKcal(kj) {
  return Math.round(kj / 4.186)
}

// kcal 转换为 kJ
function kcalToKj(kcal) {
  return Math.round(kcal * 4.186)
}

// 根据时间段自动判断餐次
function getDefaultMeal() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'snack'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'snack' // 夜宵算加餐
}

// 餐次中文映射
function getMealName(meal) {
  const map = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    snack: '加餐'
  }
  return map[meal] || '其他'
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date) {
  const d = date || new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 计算 BMR（基础代谢率）Mifflin-St Jeor 公式
function calculateBMR(gender, weight, height, age) {
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5)
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161)
  }
}

// 计算 TDEE（每日总消耗）
function calculateTDEE(bmr, activityLevel) {
  const activityMultiplier = {
    sedentary: 1.2,       // 久坐不动
    light: 1.375,         // 轻度运动（每周1-3天）
    moderate: 1.55,       // 中度运动（每周3-5天）
    active: 1.725,        // 高强度运动（每周6-7天）
    veryActive: 1.9       // 超高强度（体力劳动/专业运动员）
  }
  return Math.round(bmr * (activityMultiplier[activityLevel] || 1.2))
}

// 根据目标计算每日推荐摄入
function calculateDailyTarget(tdee, goal) {
  switch (goal) {
    case 'lose':
      return Math.round(tdee - 500)  // 减脂：每日少摄入500大卡
    case 'gain':
      return Math.round(tdee + 300)  // 增肌：每日多摄入300大卡
    case 'maintain':
    default:
      return tdee                     // 维持
  }
}

module.exports = {
  kjToKcal,
  kcalToKj,
  getDefaultMeal,
  getMealName,
  formatDate,
  calculateBMR,
  calculateTDEE,
  calculateDailyTarget
}
