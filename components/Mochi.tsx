'use client'
import { useEffect, useRef } from 'react'

export function Mochi({ size = 160 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    c.width = size * 2; c.height = size * 2
    c.style.width = `${size}px`; c.style.height = `${size}px`
    ctx.scale(2, 2)
    let frame = 0, id: number
    const cx = size / 2, cy = size / 2
    type Particle = {
      x: number
      y: number
      r: number
      vx: number
      vy: number
      a: number
      c: string
    }

    const particles: Particle[] = []
    const cols = ['#1E53E5','#4478FF','#8B5CF6']

    function draw() {
      frame++
      ctx.clearRect(0, 0, size, size)
      const fy = Math.sin(frame * 0.025) * 6
      const by = cy + fy

      if (frame % 10 === 0) particles.push({ x: cx + (Math.random()-0.5)*50, y: by+44, r: Math.random()*2+0.5, vx: (Math.random()-0.5)*0.4, vy: -(Math.random()*0.7+0.3), a: 0.7, c: cols[Math.floor(Math.random()*3)] })
      for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.a -= 0.014
        if (p.a <= 0) { particles.splice(i,1); continue }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = p.c + Math.floor(p.a*255).toString(16).padStart(2,'0'); ctx.fill()
      }

      const sg = ctx.createRadialGradient(cx, by+46, 0, cx, by+46, 30)
      sg.addColorStop(0, 'rgba(30,83,229,0.2)'); sg.addColorStop(1, 'transparent')
      ctx.beginPath(); ctx.ellipse(cx, by+46, 30, 8, 0, 0, Math.PI*2); ctx.fillStyle = sg; ctx.fill()

      const ts = Math.sin(frame*0.04)*6
      ctx.beginPath(); ctx.moveTo(cx+14, by+24); ctx.bezierCurveTo(cx+42+ts, by+42, cx+46+ts, by+16, cx+32+ts*0.5, by+4)
      ctx.strokeStyle = '#1A1A2E'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke()

      ctx.beginPath(); ctx.ellipse(cx, by+16, 32, 38, 0, 0, Math.PI*2)
      const bg = ctx.createRadialGradient(cx-8, by, 4, cx, by+16, 38)
      bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.6, '#E8EEFF'); bg.addColorStop(1, '#C4CAFF')
      ctx.fillStyle = bg; ctx.fill()

      const gl2 = (Math.sin(frame*0.04)+1)/2
      ctx.shadowColor = `rgba(30,83,229,${0.5+gl2*0.4})`; ctx.shadowBlur = 6+gl2*5
      ctx.beginPath(); ctx.moveTo(cx, by+4); ctx.lineTo(cx-8, by+20); ctx.lineTo(cx+8, by+20); ctx.closePath()
      ctx.fillStyle = `rgba(30,83,229,${0.7+gl2*0.3})`; ctx.fill()
      ctx.beginPath(); ctx.moveTo(cx, by+8); ctx.lineTo(cx-4.5, by+18); ctx.lineTo(cx+4.5, by+18); ctx.closePath()
      ctx.fillStyle = 'rgba(68,120,255,0.85)'; ctx.fill()
      ctx.shadowBlur = 0

      ;[cx-12, cx+5].forEach(lx => {
        ctx.beginPath(); ctx.roundRect(lx, by+46, 11, 14, 6)
        const lg = ctx.createLinearGradient(lx, by+46, lx, by+60)
        lg.addColorStop(0,'#DDDAFF'); lg.addColorStop(1,'#B8AFFF'); ctx.fillStyle = lg; ctx.fill()
      })

      ctx.beginPath(); ctx.ellipse(cx-36, by+22, 11, 13, -0.2, 0, Math.PI*2)
      const ag = ctx.createRadialGradient(cx-39, by+18, 2, cx-36, by+22, 13)
      ag.addColorStop(0,'#1E3A6E'); ag.addColorStop(1,'#0D1F3A'); ctx.fillStyle = ag; ctx.fill()
      ctx.strokeStyle = 'rgba(100,130,200,0.35)'; ctx.lineWidth = 1.2; ctx.stroke()
      const da = (Math.sin(frame*0.06)+1)/2
      ;[[-40,by+17],[-36,by+24],[-32,by+31]].forEach(([dx,dy]) => {
        ctx.beginPath(); ctx.arc(cx+dx, dy, 2.5, 0, Math.PI*2)
        ctx.fillStyle = `rgba(30,83,229,${0.6+da*0.4})`; ctx.shadowColor = '#4478FF'; ctx.shadowBlur = 5+da*4; ctx.fill(); ctx.shadowBlur = 0
      })

      ctx.beginPath(); ctx.ellipse(cx+34, by+22, 8, 11, 0.2, 0, Math.PI*2)
      const rg = ctx.createRadialGradient(cx+37, by+18, 2, cx+34, by+22, 11)
      rg.addColorStop(0,'#E8E4FF'); rg.addColorStop(1,'#B8AFFF'); ctx.fillStyle = rg; ctx.fill()

      ctx.beginPath(); ctx.arc(cx, by-18, 30, 0, Math.PI*2)
      const hg = ctx.createRadialGradient(cx-6, by-24, 3, cx, by-18, 30)
      hg.addColorStop(0,'#1A2744'); hg.addColorStop(0.6,'#0D1B2E'); hg.addColorStop(1,'#060D1A')
      ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = 'rgba(100,130,200,0.5)'; ctx.lineWidth = 2; ctx.stroke()

      ctx.beginPath(); ctx.arc(cx, by-18, 22, 0, Math.PI*2)
      const vg = ctx.createRadialGradient(cx-4, by-22, 2, cx, by-18, 22)
      vg.addColorStop(0, 'rgba(30,83,229,0.15)'); vg.addColorStop(1, 'transparent'); ctx.fillStyle = vg; ctx.fill()

      const sy = by-46 + ((frame*0.7) % 56)
      ctx.beginPath(); ctx.moveTo(cx-22, sy); ctx.lineTo(cx+22, sy)
      const sgl = ctx.createLinearGradient(cx-22,0,cx+22,0)
      sgl.addColorStop(0,'transparent'); sgl.addColorStop(0.5,`rgba(30,83,229,${0.3})`); sgl.addColorStop(1,'transparent')
      ctx.strokeStyle = sgl; ctx.lineWidth = 1.2; ctx.stroke()

      const eg = (Math.sin(frame*0.06)+1)/2
      const blink = Math.abs(Math.sin(frame*0.009)) < 0.06 ? 0.1 : 1
      ctx.shadowColor = '#4478FF'; ctx.shadowBlur = 10+eg*8
      ;[-1,1].forEach(side => {
        const ex = cx + side*11
        ctx.beginPath(); ctx.moveTo(ex+side*7, by-24+5*(1-blink)); ctx.lineTo(ex, by-16+5*(1-blink)); ctx.lineTo(ex, by-24+5*(1-blink)); ctx.closePath()
        ctx.fillStyle = `rgba(30,83,229,${0.85+eg*0.15})`; ctx.fill()
      })
      ctx.shadowBlur = 0

      ;[-1,1].forEach(side => {
        const ex = cx + side*18
        ctx.beginPath(); ctx.moveTo(ex-8*side*0.3, by-50); ctx.lineTo(ex+11*side, by-50); ctx.lineTo(ex+6*side, by-70); ctx.closePath()
        const erg = ctx.createLinearGradient(ex, by-70, ex, by-50)
        erg.addColorStop(0,'#4478FF'); erg.addColorStop(1,'#1E53E5'); ctx.fillStyle = erg; ctx.fill()
      })

      ;[-1,1].forEach(side => {
        const sx = cx + side*30
        ctx.beginPath(); ctx.arc(sx, by-18, 5.5, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(100,130,200,0.25)'; ctx.fill()
        ctx.beginPath(); ctx.arc(sx, by-18, 2.5, 0, Math.PI*2)
        ctx.fillStyle = `rgba(68,120,255,${0.6+eg*0.4})`; ctx.shadowColor = '#4478FF'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0
      })

      id = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(id)
  }, [size])
  return <canvas ref={ref} style={{ display: 'block' }} />
}
