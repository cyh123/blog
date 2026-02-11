'use strict';

const path = require('path');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

hexo.extend.filter.register('before_post_render', data => {
  if (!data || typeof data.content !== 'string' || typeof data.source !== 'string') {
    return data;
  }

  const source = data.source.replace(/\\/g, '/');
  if (!source.startsWith('_posts/')) {
    return data;
  }

  const basename = path.posix.basename(source, path.posix.extname(source));
  const escapedBasename = escapeRegex(basename);

  // Keep editor-friendly markdown image paths like ./<post-folder>/a.png in source,
  // but normalize them to ./a.png before rendering so marked.postAsset can resolve them.
  const mdImagePattern = new RegExp(`(!\\[[^\\]]*\\]\\()\\./${escapedBasename}/`, 'g');
  data.content = data.content.replace(mdImagePattern, '$1./');

  const htmlImagePattern = new RegExp(`(<img[^>]*?src=["'])\\./${escapedBasename}/`, 'g');
  data.content = data.content.replace(htmlImagePattern, '$1./');

  return data;
});
