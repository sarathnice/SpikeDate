export const products = {
  'spikedate.plus.weekly': {
    type: 'subscription',
    plan: 'weekly',
    superSpikes: 3,
    profileLifts: 1,
  },
  'spikedate.plus.monthly': {
    type: 'subscription',
    plan: 'monthly',
    superSpikes: 3,
    profileLifts: 1,
  },
  'spikedate.lifts.1': {
    type: 'consumable',
    profileLifts: 1,
  },
  'spikedate.lifts.3': {
    type: 'consumable',
    profileLifts: 3,
  },
  'spikedate.lifts.10': {
    type: 'consumable',
    profileLifts: 10,
  },
} as const;

export type ProductId = keyof typeof products;
