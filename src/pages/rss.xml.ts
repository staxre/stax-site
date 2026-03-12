import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: any) {
  const posts = await getCollection('blog');
  const sortedPosts = posts.sort((a: any, b: any) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  return rss({
    title: 'STAX Real Estate Blog',
    description: 'Gas station NNN investment insights, market updates, and deal flow from STAX Real Estate.',
    site: context.site,
    items: sortedPosts.map((post: any) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.excerpt,
      link: `/blog/${post.slug}/`,
      author: post.data.author,
    })),
    customData: `<language>en-us</language>`,
  });
}
