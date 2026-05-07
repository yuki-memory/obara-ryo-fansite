import { albums } from './albums.js';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

export function getYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, '');
  let videoId = null;

  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    videoId = parsedUrl.searchParams.get('v');
  }

  if (hostname === 'youtu.be') {
    videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] || null;
  }

  if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) {
    return null;
  }

  return videoId;
}

function getReleaseTime(album) {
  const releaseTime = Date.parse(album?.releaseDate || '');

  return Number.isNaN(releaseTime) ? 0 : releaseTime;
}

function getAlbumVideoSources(album) {
  if (Array.isArray(album?.videos)) {
    return album.videos;
  }

  if (album?.links?.youtube) {
    return [
      {
        title: album.title,
        kind: 'YouTube',
        url: album.links.youtube,
      },
    ];
  }

  return [];
}

export function getVideoItems({ limit } = {}) {
  const videoItems = [...albums]
    .sort((albumA, albumB) => getReleaseTime(albumB) - getReleaseTime(albumA))
    .flatMap((album) =>
      getAlbumVideoSources(album)
        .map((video) => {
          const videoId = getYouTubeVideoId(video?.url);

          if (!videoId) {
            return null;
          }

          return {
            albumId: album.id,
            albumTitle: album.title,
            releaseDate: album.releaseDate,
            type: album.type,
            title: video.title || album.title,
            kind: video.kind || 'YouTube',
            url: video.url,
            videoId,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          };
        })
        .filter(Boolean),
    );

  return Number.isFinite(limit) ? videoItems.slice(0, limit) : videoItems;
}
