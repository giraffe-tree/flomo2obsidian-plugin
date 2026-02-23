/**
 * 统一管理轻量 tooltip（支持延迟显示）
 */
export class TooltipManager {
  private tooltipEl: HTMLDivElement | null = null;
  private showTimer: number | null = null;
  private activeTarget: HTMLElement | null = null;

  show(target: HTMLElement, text: string, delayMs: number = 100): void {
    this.clearShowTimer();
    this.activeTarget = target;

    this.showTimer = window.setTimeout(() => {
      if (this.activeTarget !== target) {
        return;
      }

      this.ensureTooltip();
      if (!this.tooltipEl) {
        return;
      }

      this.tooltipEl.textContent = text;
      this.tooltipEl.classList.add('is-visible');
      this.positionTooltip(target);
    }, delayMs);
  }

  hide(): void {
    this.clearShowTimer();
    this.activeTarget = null;
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('is-visible');
    }
  }

  private ensureTooltip(): void {
    if (this.tooltipEl) {
      return;
    }

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'flomo-tooltip';
    document.body.appendChild(tooltipEl);
    this.tooltipEl = tooltipEl;
  }

  private positionTooltip(target: HTMLElement): void {
    if (!this.tooltipEl) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;

    let top = targetRect.top - tooltipRect.height - gap;
    if (top < viewportPadding) {
      top = targetRect.bottom + gap;
    }

    let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
    if (left < viewportPadding) {
      left = viewportPadding;
    } else if (left > maxLeft) {
      left = maxLeft;
    }

    this.tooltipEl.style.top = `${Math.round(top)}px`;
    this.tooltipEl.style.left = `${Math.round(left)}px`;
  }

  private clearShowTimer(): void {
    if (this.showTimer !== null) {
      window.clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }
}

let sharedTooltipManager: TooltipManager | null = null;

export function getTooltipManager(): TooltipManager {
  if (!sharedTooltipManager) {
    sharedTooltipManager = new TooltipManager();
  }
  return sharedTooltipManager;
}
