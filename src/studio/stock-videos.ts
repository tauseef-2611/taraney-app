// Curated stock background videos for Reel Studio, mapped directly from aesthetic Instagram reel references.
// Can stream from Cloudflare R2 (/api/media/stock-videos/*), static assets, or public video CDNs.
import type { Mood } from '../lib/mood';

export interface StockVideo {
  id: string;
  title: string;
  category: 'rain' | 'mist' | 'river' | 'sky' | 'spiritual' | 'forest' | 'nature' | 'aesthetic';
  desc: string;
  r2Key: string;
  fallbackUrl: string;
  referenceReel: string;
  creator: string;
  moods: Mood[];
  defaultDim: number;
}

export const STOCK_VIDEOS: StockVideo[] = [
  {
    id: 'rain-glass',
    title: 'Rain on Window Glass',
    category: 'rain',
    desc: 'Cinematic raindrops sliding down glass with warm city bokeh',
    r2Key: 'stock-videos/rain-glass.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/05/25/40149-425026938_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/CrqWtKPIrR6/',
    creator: 'garimashares',
    moods: ['gham', 'fikr'],
    defaultDim: 0.45,
  },
  {
    id: 'foggy-rain',
    title: 'Foggy Mountain Rain',
    category: 'rain',
    desc: 'Quiet rain embracing moody foggy mountains, river and bridge',
    r2Key: 'stock-videos/foggy-rain.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2019/06/19/24584-343846665_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/DecMF0jitlm/',
    creator: 'st3ess',
    moods: ['gham', 'sukoon'],
    defaultDim: 0.40,
  },
  {
    id: 'sunlight-mist',
    title: 'Sunlight in Morning Mist',
    category: 'mist',
    desc: 'Narrow rays of golden morning light moving through deep mist',
    r2Key: 'stock-videos/sunlight-mist.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2021/08/04/83875-584724896_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/Dd7F1L7Mjwq/',
    creator: 'baberafzal',
    moods: ['sukoon', 'aqeedat', 'josh'],
    defaultDim: 0.45,
  },
  {
    id: 'dark-river',
    title: 'Dark Water Ripples',
    category: 'river',
    desc: 'Nocturnal water surface with dark aesthetic ripples and reflections',
    r2Key: 'stock-videos/dark-river.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/07/28/45763-446702787_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/C-nYssJNz0h/',
    creator: 'parischristofi',
    moods: ['fikr', 'gham'],
    defaultDim: 0.50,
  },
  {
    id: 'coastal-clouds',
    title: 'Gloomy Coastal Skies',
    category: 'sky',
    desc: 'Moody overcast grey skies and slow ocean tide',
    r2Key: 'stock-videos/coastal-clouds.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/04/17/36181-412217983_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/DUMEuGUklxE/',
    creator: 'op.crisstian',
    moods: ['gham', 'fikr'],
    defaultDim: 0.40,
  },
  {
    id: 'spiritual-dusk',
    title: 'Spiritual Mountain Dusk',
    category: 'spiritual',
    desc: 'Quiet mountain peak at dusk where the soul remembers Allah',
    r2Key: 'stock-videos/spiritual-dusk.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2022/10/24/136270-763953767_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/Dc5mDQDAzWz/',
    creator: 'sohailrehmanafridi',
    moods: ['sukoon', 'aqeedat'],
    defaultDim: 0.45,
  },
  {
    id: 'autumn-mist',
    title: 'Dreamy Mountain Cloudscape',
    category: 'sky',
    desc: 'Slow moving clouds and tranquil mountain mist',
    r2Key: 'stock-videos/autumn-mist.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2021/04/16/71183-538784841_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/DXhjp8YgOnG/',
    creator: 'nature__vibes14',
    moods: ['sukoon', 'masoom', 'generic'],
    defaultDim: 0.35,
  },
  {
    id: 'misty-woods',
    title: 'Misty Pine Forest',
    category: 'forest',
    desc: 'Deep evergreen pine woods enveloped in peaceful mist',
    r2Key: 'stock-videos/misty-woods.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2022/01/18/104771-667794957_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/De8pMswJa_v/',
    creator: 'calibersadventures',
    moods: ['sukoon', 'generic'],
    defaultDim: 0.45,
  },
  {
    id: 'slow-living',
    title: 'Moody Slow Living',
    category: 'aesthetic',
    desc: 'Quiet slow-living atmosphere with rustic warmth and moody lighting',
    r2Key: 'stock-videos/slow-living.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/09/25/51139-464871404_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/Ddwb1w8qPoD/',
    creator: 'moventra',
    moods: ['sukoon', 'fikr', 'gham'],
    defaultDim: 0.40,
  },
  {
    id: 'dove-wings',
    title: 'Dove Wings & Ancient Ruins',
    category: 'aesthetic',
    desc: 'Cinematic dove wings taking flight amidst historic stone archways',
    r2Key: 'stock-videos/dove-wings.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/07/04/43831-438062828_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/DebYd4xJGLb/',
    creator: 'fliqo',
    moods: ['aqeedat', 'josh', 'sukoon'],
    defaultDim: 0.45,
  },
  {
    id: 'lake-nature',
    title: 'Clear Mountain Waters',
    category: 'river',
    desc: 'Turquoise ripples and crystal waters against majestic alpine peaks',
    r2Key: 'stock-videos/lake-nature.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2020/06/15/42075-430932587_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/CnAtFS_LCLg/',
    creator: 'nature',
    moods: ['sukoon', 'generic'],
    defaultDim: 0.40,
  },
  {
    id: 'tranquil-dusk',
    title: 'Tranquil Scenery & Sunset',
    category: 'nature',
    desc: 'Peaceful twilight silhouettes and calming evening horizon',
    r2Key: 'stock-videos/tranquil-dusk.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2021/08/13/84931-588329606_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/Db26FM8yOIf/',
    creator: 'novera',
    moods: ['sukoon', 'gham', 'aqeedat'],
    defaultDim: 0.40,
  },
  {
    id: 'peaceful-quran',
    title: 'Peaceful Recitation Nature',
    category: 'spiritual',
    desc: 'Serene nature backdrop designed for Quran and spiritual recitations',
    r2Key: 'stock-videos/peaceful-quran.mp4',
    fallbackUrl: 'https://cdn.pixabay.com/video/2021/11/03/94424-644788114_tiny.mp4',
    referenceReel: 'https://www.instagram.com/reel/De7J0xjhOz_/',
    creator: 'farah_abb',
    moods: ['aqeedat', 'sukoon'],
    defaultDim: 0.50,
  },
];

export const STOCK_VIDEO_BY_ID: Record<string, StockVideo> = (() => {
  const map: Record<string, StockVideo> = {};
  for (const v of STOCK_VIDEOS) map[v.id] = v;
  return map;
})();

/** Best matching stock video for a mood or template */
export function defaultVideoForMood(mood: Mood): StockVideo {
  return STOCK_VIDEOS.find((v) => v.moods.includes(mood)) ?? STOCK_VIDEOS[0];
}
