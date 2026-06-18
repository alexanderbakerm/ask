# Content System

This template includes a complete content management system for marketing pages, blog posts, documentation and legal pages. All content is written in MDX (Markdown + JSX) with type-safe frontmatter.

## Quick Start

### Add a Blog Post

1. Create a file in `content/posts/`:

```mdx
---
title: My New Post
date: "2025-01-15"
authorName: John Doe
authorImage: /marketing/avatars/man-2.jpg
excerpt: A brief description of the post.
tags:
  - tutorial
  - guide
published: true
---

# Introduction

Your content here...
```

2. The post appears at `/blog/my-new-post`

### Add a Documentation Page

1. Create a file in `content/docs/`:

```mdx
---
title: Getting Started
description: Learn how to get started
icon: Rocket
---

## Overview

Your documentation here...
```

2. Add to navigation in `content/docs/meta.json`:

```json
{
  "pages": [
    "index",
    "getting-started"  // Add your page
  ]
}
```

3. The page appears at `/docs/getting-started`

### Add a Legal Page

1. Create a file in `content/legal/`:

```mdx
---
title: Refund Policy
---

## Our Refund Policy

Content here...
```

2. The page appears at `/legal/refund`
3. Add link to footer in `components/marketing/navigation/footer.tsx`

## Content Structure

```
content/
├── posts/           # Blog articles
├── docs/            # Documentation
│   └── meta.json    # Navigation structure
├── legal/           # Legal pages (privacy, terms, cookies)
└── authors/         # Author profiles (optional)
```

## Blog System

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Post title |
| `date` | string | Yes | ISO date (e.g., "2025-01-15") |
| `authorName` | string | Yes | Author display name |
| `authorImage` | string | No | Author avatar URL |
| `authorLink` | string | No | Author profile link |
| `excerpt` | string | No | Short description |
| `image` | string | No | Featured image URL |
| `tags` | string[] | Yes | Array of tags |
| `published` | boolean | Yes | Publication status |

### Example Post

```mdx
---
title: 5 Ways to Boost Team Productivity
date: "2025-01-10"
authorName: Jane Doe
authorImage: https://randomuser.me/api/portraits/women/11.jpg
excerpt: Discover proven strategies to enhance your team's efficiency.
tags:
  - productivity
  - teams
  - tips
published: true
---

# Introduction

Teams that work efficiently...

## 1. Set Clear Goals

Setting clear, measurable goals...

## 2. Use the Right Tools

The right tools can make all the difference...

```js
// Example code with syntax highlighting
const productivity = calculateEfficiency(team);
```

## Conclusion

By implementing these strategies...
```

### Features

- **Syntax highlighting**: Uses Shiki with "nord" theme
- **Reading time**: Auto-calculated (250 words/minute)
- **SEO**: Dynamic metadata and OpenGraph tags
- **Smart links**: Internal links use Next.js routing, external open in new tab
- **Image optimization**: Uses `next/image` for all images

### Querying Posts

```typescript
import { getAllPosts, getPostBySlug } from "@/lib/marketing/blog/posts";

// Get all posts
const posts = await getAllPosts();

// Get single post
const post = await getPostBySlug("my-post-slug");

// Filter published posts
const publishedPosts = posts.filter(p => p.published);

// Sort by date
const sorted = posts.sort((a, b) => 
  new Date(b.date).getTime() - new Date(a.date).getTime()
);
```

## Documentation System

The documentation system uses [Fumadocs](https://fumadocs.vercel.app/) for a full-featured docs experience.

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page title |
| `description` | string | No | Page description |
| `icon` | string | No | Lucide icon name |
| `full` | boolean | No | Full-width layout |

### Navigation (meta.json)

Control the sidebar navigation in `content/docs/meta.json`:

```json
{
  "title": "Documentation",
  "root": true,
  "pages": [
    "[House][Homepage](/)",
    "---Getting Started---",
    "index",
    "installation",
    "---Features---",
    "authentication",
    "billing",
    "---API---",
    "api-reference"
  ]
}
```

**Syntax:**
- `"page-name"` - Reference to MDX file (without extension)
- `"---Section Title---"` - Section separator
- `"[Icon][Label](url)"` - External link with Lucide icon

### Available MDX Components

Use these components directly in your docs:

#### Tabs

```mdx
<Tabs items={['npm', 'yarn', 'pnpm']}>
<Tab value="npm">
```bash
npm install package
```
</Tab>
<Tab value="yarn">
```bash
yarn add package
```
</Tab>
</Tabs>
```

#### Steps

```mdx
<Steps>
<Step>
### Install Dependencies
Run `npm install` to install all dependencies.
</Step>
<Step>
### Configure Environment
Copy `.env.example` to `.env` and fill in values.
</Step>
</Steps>
```

#### Callouts

```mdx
<Callout title="Note">
This is important information.
</Callout>

<Callout type="warn" title="Warning">
Be careful with this action.
</Callout>

<Callout type="error" title="Error">
This will cause problems.
</Callout>
```

#### File Trees

```mdx
<Files>
  <Folder name="src" defaultOpen>
    <File name="index.ts" />
    <Folder name="components">
      <File name="Button.tsx" />
    </Folder>
  </Folder>
  <File name="package.json" />
</Files>
```

#### Cards

```mdx
<Cards>
  <Card title="Getting Started" href="/docs">
    Learn the basics
  </Card>
  <Card title="API Reference" href="/docs/api">
    Detailed API documentation
  </Card>
</Cards>
```

#### Image Zoom

Images automatically support click-to-zoom:

```mdx
![Screenshot](/images/screenshot.png)
```

### Code Highlighting Features

```typescript
// Highlight specific lines
const config = {
  // [!code highlight]
  apiKey: process.env.API_KEY,
  debug: true,
};

// Show diffs
const value = "old"; // [!code --]
const value = "new"; // [!code ++]

// Highlight words
const config = loadConfig(); // [!code word:config]
```

Add title to code blocks:

````mdx
```typescript title="src/config.ts"
export const config = { ... };
```
````

## Legal Pages

### Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Page title |

### Example

```mdx
---
title: Privacy Policy
---

## Information We Collect

We collect information you provide directly...

## How We Use Your Information

We use the information we collect to...

## Contact Us

If you have questions, contact us at privacy@example.com.
```

### Default Legal Pages

- `/legal/privacy` - Privacy Policy
- `/legal/terms` - Terms of Service  
- `/legal/cookies` - Cookie Policy

## Marketing Pages

### Homepage Sections

The homepage (`app/(marketing)/page.tsx`) is composed of section components:

```typescript
export default async function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoCloudSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <HomePricingSection />
      <FaqSection />
      <LatestArticlesSection posts={posts} />
      <CtaSection />
    </>
  );
}
```

### Available Section Components

Located in `components/marketing/sections/`:

| Component | Purpose |
|-----------|---------|
| `HeroSection` | Main hero with CTA buttons |
| `LogoCloudSection` | Client/partner logos |
| `FeaturesSection` | Feature highlights |
| `StatsSection` | Statistics/metrics |
| `TestimonialsSection` | Customer testimonials |
| `PricingSection` | Full pricing table |
| `HomePricingSection` | Compact pricing preview |
| `FaqSection` | FAQ accordion |
| `LatestArticlesSection` | Recent blog posts |
| `CtaSection` | Call-to-action |
| `AboutSection` | About page content |
| `ContactSection` | Contact form |
| `CareersSection` | Job listings |
| `ChangelogSection` | Version history |
| `StorySection` | Company story |

### Creating New Pages

1. Create a new page in `app/(marketing)/`:

```typescript
// app/(marketing)/features/page.tsx
import { FeaturesSection } from "@/components/marketing/sections/features-section";

export default function FeaturesPage() {
  return (
    <div className="pt-24">
      <FeaturesSection />
    </div>
  );
}
```

2. Add to navigation in `components/marketing/navigation/header.tsx`:

```typescript
const BASE_MENU_LINKS = [
  { title: "Features", href: "/features" },
  // ...
];
```

## Navigation

### Header

The header (`components/marketing/navigation/header.tsx`) includes:
- Logo with link to homepage
- Desktop navigation menu (centered)
- Mobile hamburger menu
- Auth-aware buttons (Sign in/Dashboard)
- Theme toggle

### Footer

The footer (`components/marketing/navigation/footer.tsx`) includes:
- Logo and description
- Four link columns (Product, Resources, Company, Legal)
- Social media links
- Theme switcher
- Copyright notice

To add footer links:

```typescript
const footerLinks = [
  {
    group: "Product",
    items: [
      { title: "Features", href: "/features" },
      { title: "New Link", href: "/new-page" },
    ],
  },
  // ...
];
```

## Configuration

### App Config

Edit `config/app.config.ts`:

```typescript
export const appConfig = {
  appName: "Your App",
  description: "Your app description",
  contact: {
    enabled: true,  // Show contact page and footer link
    phone: "(123) 456-7890",
    address: "123 Main St, City, State",
  },
};
```

## SEO

### Automatic Features

- **Dynamic metadata**: All content pages generate title, description, OpenGraph
- **JSON-LD**: Homepage includes Organization and WebSite schemas
- **Static generation**: Legal and docs pages are statically generated

### Adding OpenGraph Images

For blog posts, add the `image` field:

```yaml
---
title: My Post
image: /images/my-post-og.png
---
```

## Customization

### Custom MDX Components (Blog)

Edit `lib/marketing/blog/mdx-components.tsx`:

```typescript
export const mdxComponents = {
  // Override or add components
  CustomAlert: ({ children }) => (
    <div className="bg-blue-100 p-4 rounded">{children}</div>
  ),
};
```

### Custom MDX Components (Docs)

Edit `app/docs/[[...slug]]/page.tsx`:

```typescript
<MDX
  components={{
    ...defaultMdxComponents,
    CustomComponent: MyCustomComponent,
  }}
/>
```

### Styling Prose

Blog and legal pages use Tailwind's `prose` classes. Customize in content components:

```typescript
className="prose prose-gray dark:prose-invert 
  prose-headings:font-semibold 
  prose-a:text-primary"
```

## File Reference

| File | Purpose |
|------|---------|
| `content-collections.ts` | Collection definitions |
| `source.config.ts` | Fumadocs config |
| `content/posts/*.mdx` | Blog posts |
| `content/docs/*.mdx` | Documentation |
| `content/docs/meta.json` | Docs navigation |
| `content/legal/*.mdx` | Legal pages |
| `lib/marketing/blog/posts.ts` | Blog queries |
| `lib/marketing/blog/mdx-components.tsx` | Blog MDX components |
| `lib/marketing/legal/pages.ts` | Legal queries |
| `lib/marketing/docs/source.ts` | Docs source loader |
| `app/(marketing)/` | Marketing routes |
| `app/docs/` | Documentation routes |
| `components/marketing/sections/` | Page sections |
| `components/marketing/navigation/` | Header, footer |
| `components/marketing/content/` | Content renderers |
