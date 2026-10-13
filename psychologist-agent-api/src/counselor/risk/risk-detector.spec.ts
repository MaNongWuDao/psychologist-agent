import { assessRisk, isCrisis } from './risk-detector';

describe('assessRisk', () => {
  it('普通倾诉不触发风险', () => {
    const result = assessRisk('最近工作上有点小忙，想找人聊聊怎么安排时间。');

    expect(result.level).toBe('none');
    expect(result.evidence).toHaveLength(0);
    expect(isCrisis(result.level)).toBe(false);
  });

  it('一般性情绪困扰判定为 low', () => {
    const result = assessRisk('这周总是失眠，白天心慌，压力很大。');

    expect(result.level).toBe('low');
    expect(result.categories).toContain('distress');
  });

  it('无望感判定为 medium 并给出安全确认建议', () => {
    const result = assessRisk('我觉得特别绝望，看不到希望，真的撑不下去了。');

    expect(result.level).toBe('medium');
    expect(result.categories).toContain('hopelessness');
    expect(result.guidance).toContain('安全');
  });

  it('自杀意念判定为 high 并进入危机流程', () => {
    const result = assessRisk('我不想活了，有时候会想从楼上跳下去。');

    expect(result.level).toBe('high');
    expect(isCrisis(result.level)).toBe(true);
    expect(result.categories).toContain('suicide');
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.guidance).toContain('热线');
  });

  it('识别准备行为并升级为高风险', () => {
    const result = assessRisk('遗书我已经写好了，也买好了安眠药。');

    expect(result.level).toBe('high');
    expect(result.evidence.join()).toContain('遗书');
  });

  it('识别伤害他人的风险', () => {
    const result = assessRisk('我现在特别想弄死他，跟他同归于尽。');

    expect(result.level).toBe('high');
    expect(result.categories).toContain('harmToOthers');
  });

  it('否定表述不会误报为危机', () => {
    const result = assessRisk('你别担心，我不会自杀的，我只是最近很累。');

    expect(result.level).not.toBe('high');
  });
});
