import { perlin } from './perilinNoise'
import debounce from 'lodash/debounce'

const draw = (ctx) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = '#000000'
  perlin.seed()

  function gradient(a, b) {
    return (b.y - a.y) / (b.x - a.x)
  }

  function bzCurve(points, f, t) {
    if (typeof f == 'undefined') f = 0.3
    if (typeof t == 'undefined') t = 0.6

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)

    let m = 0
    let dx1 = 0
    let dx2
    let dy1 = 0
    let dy2

    let previousPoint = points[0]
    let nextPoint
    for (let i = 1; i < points.length; i++) {
      let currentPoint = points[i]
      nextPoint = points[i + 1]
      if (nextPoint) {
        m = gradient(previousPoint, nextPoint)
        dx2 = (nextPoint.x - currentPoint.x) * -f
        dy2 = dx2 * m * t
      } else {
        dx2 = 0
        dy2 = 0
      }

      ctx.bezierCurveTo(
        previousPoint.x - dx1,
        previousPoint.y - dy1,
        currentPoint.x + dx2,
        currentPoint.y + dy2,
        currentPoint.x,
        currentPoint.y,
      )

      dx1 = dx2
      dy1 = dy2
      previousPoint = currentPoint
    }
    ctx.stroke()
  }

  const stepX = 65 // control the width of X.
  const stepY = 13
  for (let y = -50; y < 150; y++) {
    // Generate random data
    const lines = []
    let pointX = 0
    let pointY = 0
    let point = { x: pointX, y: pointY }
    for (let x = 0; x < ctx.canvas.width; x += stepX) {
      const noiseModifier = perlin.get(x / 225, y / 125) * 250
      pointY = noiseModifier * 2 + y * stepY
      point = { x: pointX, y: pointY }
      lines.push(point)
      pointX = pointX + stepX
      ctx.lineWidth = Math.min(Math.max(0.2 + Math.abs(noiseModifier) / 150, 0.2), 0.45)
    }

    // Draw smooth line
    ctx.strokeStyle = '#EEE'
    bzCurve(lines, 0.3, 1)
  }
}

const canvas = document.getElementById('canvas')
const ctx = canvas?.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.canvas.width = window.innerWidth + 100
ctx.canvas.height = window.innerHeight + 400
draw(ctx)
const handleResize = () => {
  draw(ctx)
}

window.addEventListener('resize', debounce(handleResize, 400))
