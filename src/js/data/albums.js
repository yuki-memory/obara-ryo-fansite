const albumImagePath = (fileName) =>
  new URL(`../../../assets/images/albums/${fileName}`, import.meta.url).href;

const characterImagePath = (fileName) =>
  new URL(`../../../assets/images/characters/${fileName}`, import.meta.url)
    .href;

export const albums = [
  {
    id: 'album-placeholder-0',
    type: '1st Digital Single',
    title: 'Goodday!!',
    releaseDate: '2020-05-17',
    image: albumImagePath('album__001.webp'),
    jacket: albumImagePath('album__001.webp'),
    tracks: ['Goodday!!'],
    links: {
      appleMusic:
        'https://music.apple.com/jp/album/goodday/1513538072?i=1513538073',
    },
    videos: [
      {
        title: 'Goodday!!',
        kind: 'YouTube',
        url: 'https://www.youtube.com/watch?v=2Q3ZWhmwntQ',
      },
    ],
  },
  {
    id: 'album-placeholder-1',
    type: '1st Single',
    title: 'Re:shine',
    releaseDate: '2021-06-12',
    image: albumImagePath('album__002.webp'),
    jacket: albumImagePath('album__002.webp'),
    tracks: ['Re:shine', 'Sunny ship'],
    links: {
      linkcore: 'https://linkco.re/zMavf2pr',
      spotify: 'https://open.spotify.com/intl-ja/album/6oRo95HoKboJtwnbSYoQ0F',
      appleMusic: 'https://music.apple.com/jp/album/re-shine-single/1693065185',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0C8F17KY1',
    },
    videos: [
      {
        title: 'Re:shine（mv）',
        kind: 'Music Video',
        url: 'https://www.youtube.com/watch?v=JkIWtN9n2jU',
      },
      {
        title: 'Sunny ship（mv）',
        kind: 'Music Video',
        url: 'https://www.youtube.com/watch?v=ojEv2AvznHk',
      },
    ],
  },
  {
    id: 'album-placeholder-2',
    type: '2nd Single',
    title: '全力！ジェリーフィッシュ',
    releaseDate: '2021-08-14',
    image: albumImagePath('album__003.webp'),
    jacket: albumImagePath('album__003.webp'),
    tracks: ['全力！ジェリーフィッシュ', 'ココじゃない透明'],
    links: {
      linkcore: 'https://linkco.re/RGtr3tDq',
      spotify: 'https://open.spotify.com/intl-ja/album/6siXpE8l9TSFFB6c9dbKD3',
      appleMusic:
        'https://music.apple.com/jp/album/zenryoku-jelly-fish-single/1693065578',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0C8FSNZLX',
    },
    videos: [
      {
        title: 'ココじゃない透明（Live動画）',
        kind: 'Live',
        url: 'https://www.youtube.com/watch?v=TG-8Dg3Cab4',
      },
    ],
  },
  {
    id: 'album-placeholder-3',
    type: '3rd Single',
    title: 'POP STEP 脱兎！',
    releaseDate: '2021-09-04',
    image: albumImagePath('album__004.webp'),
    jacket: albumImagePath('album__004.webp'),
    tracks: ['POP STEP 脱兎！', 'One Punch Punish!'],
    links: {
      linkcore: 'https://linkco.re/MEV5SeaE',
      spotify: 'https://open.spotify.com/intl-ja/album/5qsnyaaZdBmTIy7GwBntJd',
      appleMusic:
        'https://music.apple.com/jp/album/pop-step-datto-single/1693075171',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0C8GXGVFT',
    },
    videos: [
      {
        title: 'POP STEP 脱兎！（振り付け動画）',
        kind: 'Choreography',
        url: 'https://www.youtube.com/watch?v=H_JT4zNsJEg',
      },
      {
        title: 'One Punch Punish!（振り付け動画）',
        kind: 'Choreography',
        url: 'https://www.youtube.com/watch?v=e68EO9EA9O4',
      },
    ],
  },
  {
    id: 'album-placeholder-4',
    type: '4th Single',
    title: 'オンリーワンダーランド',
    releaseDate: '2021-10-12',
    image: albumImagePath('album__005.webp'),
    jacket: albumImagePath('album__005.webp'),
    tracks: ['オンリーワンダーランド', 'リングリングソング'],
    links: {
      linkcore: 'https://linkco.re/PXHFXsB2',
      spotify: 'https://open.spotify.com/intl-ja/album/20M5xhWivHPTdxX1JEZB5H',
      appleMusic:
        'https://music.apple.com/jp/album/only-wonderland-single/1693075217',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0C8L6QFFR',
    },
    videos: [],
  },
  {
    id: 'album-placeholder-5',
    type: '1st Album',
    title: 'PUZZLE',
    releaseDate: '2021-10-02',
    image: albumImagePath('album__006.webp'),
    jacket: albumImagePath('album__006.webp'),
    tracks: [
      'PUZZLE',
      'RAKUYOU SPLASH！',
      'キミ色「happy☆peace」',
      'ウォーターベル',
      'サークルゲーム',
      'フォレストアドベンチャー',
      'DAKEDO',
      'テンションノート',
    ],
    links: {
      linkcore: 'https://linkco.re/xXeU1DCB',
      spotify: 'https://open.spotify.com/intl-ja/album/3gakFAC47UFfIBByJyEGji',
      appleMusic: 'https://music.apple.com/jp/album/puzzle/1690619462',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0C6V76M63',
    },
    videos: [
      {
        title: 'ウォーターベル（Live動画）',
        kind: 'Live',
        url: 'https://www.youtube.com/watch?v=tKx39jSnlTc',
      },
    ],
  },
  {
    id: 'album-placeholder-6',
    type: '5th Single',
    title: 'ビバ！バビデブー',
    releaseDate: '2023-07-01',
    image: albumImagePath('album__007.webp'),
    jacket: albumImagePath('album__007.webp'),
    tracks: ['ビバ！バビデブー', 'step!step!step!'],
    links: {
      linkcore: 'https://linkco.re/65tbp7Mf',
      spotify: 'https://open.spotify.com/intl-ja/album/3J0H6AVduzcSrOYNLfJK1F',
      appleMusic:
        'https://music.apple.com/jp/album/viva-bobbidi-boo-single/1746003520',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0D4186V22',
    },
    videos: [],
  },
  {
    id: 'album-placeholder-7',
    type: '2nd Digital Single',
    title: 'ぐるぐるビクトリー',
    releaseDate: '2024-06-20',
    image: albumImagePath('album__008.webp'),
    jacket: albumImagePath('album__008.webp'),
    tracks: ['ぐるぐるビクトリー'],
    links: {
      linkcore: 'https://linkco.re/gEnGDqam',
      spotify: 'https://open.spotify.com/intl-ja/album/43fiIaDLhaL1Nxpp0O7FBu',
      appleMusic:
        'https://music.apple.com/jp/album/guru-guru-victory-single/1751155922',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0D6LRFGGT',
    },
    videos: [],
  },
  {
    id: 'album-placeholder-8',
    type: '6th Single',
    title: 'スーパーヒーロー',
    releaseDate: '2024-10-05',
    image: albumImagePath('album__009.webp'),
    jacket: albumImagePath('album__009.webp'),
    tracks: ['スーパーヒーロー', 'ぐるぐるビクトリー'],
    links: {
      linkcore: 'https://linkco.re/5Hq3XzS3?lang=ja',
      spotify: 'https://open.spotify.com/intl-ja/album/0kyn6U2Ey3a1AYAU5epuRs',
      appleMusic:
        'https://music.apple.com/jp/album/superhero-single/1784386411',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0DPZ9STXH',
    },
    videos: [],
  },
  {
    id: 'album-placeholder-9',
    type: '1st Acoustic Album',
    title: 'MOON LIGHT',
    releaseDate: '2025-02-16',
    image: albumImagePath('album__010.webp'),
    jacket: albumImagePath('album__010.webp'),
    tracks: [
      '僕はYumekui',
      'ココじゃない透明',
      'DAKEDO',
      'RAKUYOU SPLASH！',
      'テンションノート',
    ],
    links: {},
    videos: [
      {
        title: '僕はYumekui（mv）',
        kind: 'Music Video',
        url: 'https://www.youtube.com/watch?v=DrUstvPHPnE',
      },
    ],
  },
  {
    id: 'album-placeholder-10',
    type: '7th Single',
    title: 'flower',
    releaseDate: '2025-10-04',
    image: albumImagePath('album__011.webp'),
    jacket: albumImagePath('album__011.webp'),
    characterImage: characterImagePath('character_pose_smile.webp'),
    tracks: ['flower', 'シアワセノリユウ'],
    links: {
      tunecore: 'https://www.tunecore.co.jp/artists/obararyo',
      spotify: 'https://open.spotify.com/intl-ja/album/4aTuq3U62fHtEsjsMbYUjm',
      appleMusic: 'https://music.apple.com/jp/album/flower-single/1826035445',
      amazonMusic: 'https://www.amazon.co.jp/music/player/albums/B0FH9MZJ1G',
    },
    videos: [
      {
        title: 'flower（mv）',
        kind: 'Music Video',
        url: 'https://www.youtube.com/watch?v=evC0dNJGF6E',
      },
    ],
  },
  {
    id: 'album-placeholder-11',
    type: '3rd Digital Single',
    title: 'STORY',
    releaseDate: '2025-12-08',
    image: albumImagePath('album__012.webp'),
    jacket: albumImagePath('album__012.webp'),
    characterImage: characterImagePath('character_pose_point.webp'),
    tracks: ['STORY'],
    links: {},
    videos: [
      {
        title: 'STORY live映像',
        kind: 'Live',
        url: 'https://www.youtube.com/watch?v=irWkatfmfWY',
      },
    ],
  },
];
