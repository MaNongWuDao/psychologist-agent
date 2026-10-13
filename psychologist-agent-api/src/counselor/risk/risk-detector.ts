import { RiskCategory, RiskLevel } from '../domain/types';

interface RiskRule {
  id: string;
  category: RiskCategory;
  level: RiskLevel;
  weight: number;
  patterns: RegExp[];
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  categories: RiskCategory[];
  /** 命中的原文片段，用于向咨询师/审计方解释判定依据 */
  evidence: string[];
  /** 供下游节点与前端展示的处置建议 */
  guidance: string;
}

const HIGH: RiskLevel = 'high';
const MEDIUM: RiskLevel = 'medium';
const LOW: RiskLevel = 'low';

const RULES: RiskRule[] = [
  {
    id: 'suicidal-ideation',
    category: 'suicide',
    level: HIGH,
    weight: 10,
    patterns: [
      /自杀/,
      /轻生/,
      /想死/,
      /不想活/,
      /不想再活/,
      /活不下去/,
      /活够了/,
      /结束(自己的)?生命/,
      /了结(自己)?/,
      /死了算了/,
      /永远睡过去/,
      /从(楼|桥|窗户)(上)?(跳|跳下|跳下去)/,
      /kill\s*myself/i,
      /suicide/i,
    ],
  },
  {
    id: 'suicidal-plan',
    category: 'suicide',
    level: HIGH,
    weight: 14,
    patterns: [
      /(遗书|遗嘱)(都)?(写好了|写完了|准备好)/,
      /(准备好|买好|攒够|存了).{0,6}(药|安眠药|农药|绳子|刀)/,
      /(打算|决定|计划|想好).{0,8}(自杀|轻生|了结|去死)/,
      /(今晚|今天|待会|马上|明天).{0,6}(就)?(去)?(死|自杀|了结)/,
    ],
  },
  {
    id: 'self-harm',
    category: 'selfHarm',
    level: HIGH,
    weight: 9,
    patterns: [
      /自残/,
      /割腕/,
      /伤害自己/,
      /伤害我自己/,
      /拿刀划/,
      /烫自己/,
      /撞墙/,
      /咬自己/,
      /self[\s-]*harm/i,
    ],
  },
  {
    id: 'harm-to-others',
    category: 'harmToOthers',
    level: HIGH,
    weight: 12,
    patterns: [
      /(杀|弄|捅|砍)(了|光)?(他|她|它|他们|你们|全家)/,
      /报复社会/,
      /(想|要)(杀|弄死|同归于尽)/,
      /带(着|上).{0,4}(一起死|同归于尽)/,
      /kill\s*(him|her|them)/i,
    ],
  },
  {
    id: 'hopelessness',
    category: 'hopelessness',
    level: MEDIUM,
    weight: 5,
    patterns: [
      /绝望/,
      /没有希望/,
      /看不到(任何)?希望/,
      /撑不下去/,
      /熬不下去/,
      /没有意义/,
      /活着(好)?累/,
      /行尸走肉/,
      /想消失/,
      /消失掉/,
      /我是(个)?(累赘|负担|废物)/,
    ],
  },
  {
    id: 'distress',
    category: 'distress',
    level: LOW,
    weight: 2,
    patterns: [
      /焦虑/,
      /抑郁/,
      /失眠/,
      /睡不着/,
      /情绪低落/,
      /崩溃/,
      /喘不上气/,
      /惊恐/,
      /心慌/,
      /压力(好|很|特别)?大/,
      /控制不住(情绪|眼泪)/,
    ],
  },
];

/**
 * 针对中英文常见否定表述的降级规则。
 * 例：“我不会自杀的”不应触发危机流程，但依然需要被温和地回应。
 */
const NEGATION_BEFORE =
  /(不会|没有|从没|不再|不想再|从未|没想过)\s{0,4}(去)?\s{0,4}$/;

const RISK_META: Record<RiskLevel, { score: number; guidance: string }> = {
  none: { score: 0, guidance: '常规倾听与共情回应。' },
  low: { score: 1, guidance: '正常咨询流程，留意情绪变化并做情绪稳定化引导。' },
  medium: {
    score: 6,
    guidance:
      '加强情绪支持，探索无望感的来源，评估支持系统，并在对话中确认安全状况。',
  },
  high: {
    score: 10,
    guidance:
      '立即进入危机干预流程：直接、温和地询问安全状况，提供心理援助热线，鼓励联系身边可信任的人或专业机构。',
  },
};

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?\n\r；;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function findEvidence(text: string, pattern: RegExp): string | undefined {
  for (const sentence of splitSentences(text)) {
    if (!pattern.test(sentence)) {
      continue;
    }
    const match = pattern.exec(sentence);
    const index = match?.index ?? 0;
    const isNegated = NEGATION_BEFORE.test(sentence.slice(0, index));
    if (isNegated) {
      continue;
    }
    return sentence;
  }
  return undefined;
}

/**
 * 确定性的危机筛查。规则结果不会被模型覆盖，
 * 因此即使模型输出异常，高风险个案也不会被漏过。
 */
export function assessRisk(text: string): RiskAssessment {
  const normalized = text ?? '';
  const evidence: string[] = [];
  const categories = new Set<RiskCategory>();
  let level: RiskLevel = 'none';
  let score = RISK_META.none.score;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const snippet = findEvidence(normalized, pattern);
      if (!snippet) {
        continue;
      }
      evidence.push(snippet);
      categories.add(rule.category);
      score += rule.weight;
      score = Math.max(score, RISK_META[rule.level].score);
      if (RISK_META[rule.level].score > RISK_META[level].score) {
        level = rule.level;
      }
    }
  }

  return {
    level,
    score,
    categories: [...categories],
    evidence: [...new Set(evidence)],
    guidance: RISK_META[level].guidance,
  };
}

export function isCrisis(level: RiskLevel): boolean {
  return level === 'high';
}
