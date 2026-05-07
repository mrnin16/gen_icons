export type IconDTO = {
  id: string;
  name: string;
  slug: string;
  svgContent: string;
  category: string;
  style: string;
  tags: string[];
  isAiGenerated: boolean;
  isPublic: boolean;
  iconType: string;
  animationData?: string | null;
  downloads: number;
};

export type IconsResponse = {
  icons: IconDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CategoriesResponse = {
  categories: { name: string; count: number }[];
};
