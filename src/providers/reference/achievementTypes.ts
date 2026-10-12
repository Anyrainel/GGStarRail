export interface AchievementLogic {
  categories: {
    id: number;
    order: number;
    achievements: {
      id: number;
      order: number;
      reward: 5 | 10 | 20;
      version?: string;
    }[][];
  }[];
}

export interface AchievementText {
  categories: Record<string, string>;
  achievements: Record<string, { name: string; desc: string | number[] }>;
  descriptionTemplates?: string[];
}

export interface AchievementDisplayData {
  categories: { id: number; order: number; name: string }[];
  achievements: {
    id: number;
    order: number;
    reward: 5 | 10 | 20;
    version?: string;
    categoryId: number;
    groupIds: number[];
    name: string;
    description: string;
  }[];
}
