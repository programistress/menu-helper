# MenuHelper 🍽️

AI-powered menu analyzer that scans restaurant menus, provides dish descriptions, and makes personalized food recommendations.

## Features

- 📸 **Menu Scanning**: Upload a photo of any menu and get instant dish recognition
- 🤖 **AI Descriptions**: OpenAI-powered descriptions for every dish
- ⭐ **Smart Recommendations**: Personalized suggestions based on your preferences
- 🖼️ **Dish Images**: Automatic image search for visual context
- 🎯 **Preference Management**: Set dietary restrictions, allergies, and flavor preferences

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Backend**: Express, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI GPT-4 Vision & Chat APIs
- **Image Search**: Google Custom Search API
- **Caching**: Vercel KV
- **Deployment**: Vercel

## Prerequisites

Before deploying, you'll need:

1. **PostgreSQL Database** (Neon, Vercel Postgres, or Supabase)
2. **OpenAI API Key** ([platform.openai.com](https://platform.openai.com))
3. **Google Custom Search API**:
   - API Key from [Google Cloud Console](https://console.cloud.google.com)
   - Custom Search Engine ID from [Programmable Search Engine](https://programmablesearchengine.google.com)
4. **Vercel Account** ([vercel.com](https://vercel.com))

## Environment Variables

Create a `.env` file in the root directory (use `.env.example` as template):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# OpenAI API
OPENAI_API_KEY=sk-...

# Google Custom Search
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...

# Node Environment
NODE_ENV=development
PORT=5000
```

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Push database schema**:
   ```bash
   npm run db:push
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open browser**: Navigate to `http://localhost:5000`

## Database Management

- **Push schema changes**: `npm run db:push`
- **Open Drizzle Studio**: `npm run db:studio`
- **Generate migrations**: `npm run db:generate`
- **Test database connection**: `npm run db:test`

## Deployment to Vercel

### Option 1: Deploy with Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Add environment variables** in Vercel dashboard:
   - Go to your project settings
   - Add all variables from `.env.example`
   - Redeploy after adding variables

### Option 2: Deploy via GitHub

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy!

### Setting Up Database on Vercel

After deploying, push your database schema:

```bash
# Set DATABASE_URL environment variable in Vercel first
npm run db:push
```

## API Endpoints

- `POST /api/analyze` - Upload and analyze menu image
- `GET /api/preferences` - Get user preferences
- `POST /api/preferences` - Save user preferences
- `POST /api/recommendations` - Get personalized recommendations
- `POST /api/dish/detail` - Get detailed dish description

## Environment-Specific Schemas

The app uses different PostgreSQL schemas based on environment:
- **Production** (main branch): `public` schema
- **Development/Preview**: `development` schema

This allows you to test changes in preview deployments without affecting production data.

## Rate Limiting

The app implements smart rate limiting for external API calls:
- OpenAI API calls are cached and rate-limited
- Google Image Search results are cached
- Descriptions are stored in database to minimize API usage

## Troubleshooting

### Build Errors

- Ensure all environment variables are set in Vercel
- Check that `DATABASE_URL` is accessible from Vercel servers
- Verify API keys are valid

### Database Connection Issues

- Make sure PostgreSQL allows connections from Vercel IPs
- For Neon: Connection pooling should be enabled
- Check SSL mode is set correctly: `?sslmode=require`

### API Rate Limits

- Monitor your OpenAI usage at [platform.openai.com](https://platform.openai.com)
- Google Custom Search: Free tier has 100 queries/day
- Consider upgrading plans for production use

## Cost Considerations

- **Vercel**: Free hobby tier available
- **Database**: Neon has free tier (0.5GB storage)
- **OpenAI**: Pay per token (GPT-4 Vision is ~$0.01-0.03 per image)
- **Google Custom Search**: Free 100 queries/day, $5 per 1000 after

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
