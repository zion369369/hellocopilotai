/**
 * Sovereign Visualizer: High-Fidelity Siri Orb Rendering Engine
 * Utilizes procedural noise, radial gradients, and linear interpolation (lerp)
 * to translate real-time RMS volumes into an evocative, pulsing visual entity.
 */
export class SiriOrbVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.points = 8;
        this.audioLevel = 0;
        this.smoothedLevel = 0;
        this.phi = 0;
        this.lerpFactor = 0.15; // Smooth "viscosity"
        this.baseRadius = 60;
        this.isAnimating = false;
        
        // Colors from Google's Intelligence Palette
        this.colors = [
            'rgba(66, 133, 244, 0.5)',  // Blue
            'rgba(155, 114, 203, 0.5)', // Purple
            'rgba(217, 101, 112, 0.5)', // Red
            'rgba(243, 175, 61, 0.5)'   // Orange
        ];
    }

    start() {
        this.isAnimating = true;
        this.animate();
    }

    stop() {
        this.isAnimating = false;
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    updateLevel(v) {
        this.audioLevel = v;
    }

    animate() {
        if (!this.isAnimating) return;
        
        // 1. Level Smoothing (lerp)
        this.smoothedLevel += (this.audioLevel - this.smoothedLevel) * this.lerpFactor;
        this.phi += 0.05 + this.smoothedLevel * 0.1;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.globalCompositeOperation = 'screen';
        
        // Layer multiple oscillating blobs for ethereal effect
        for (let i = 0; i < 4; i++) {
            this.drawBlob(i);
        }
        
        requestAnimationFrame(() => this.animate());
    }

    drawBlob(index) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const r = this.baseRadius + (this.smoothedLevel * 60) + (Math.sin(this.phi * 0.5 + index) * 5);
        
        this.ctx.beginPath();
        const angleStep = (Math.PI * 2) / this.points;
        const time = this.phi + index;
        
        for (let i = 0; i <= this.points; i++) {
            const angle = i * angleStep;
            const noise = Math.sin(time + i) * (this.smoothedLevel * 25 + index * 5);
            const x = cx + (r + noise) * Math.cos(angle);
            const y = cy + (r + noise) * Math.sin(angle);
            
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        
        this.ctx.closePath();
        
        // Creative radial gradient
        const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 40);
        grad.addColorStop(0, this.colors[index]);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        
        // Subtle outline for definition
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + this.smoothedLevel * 0.4})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
}
