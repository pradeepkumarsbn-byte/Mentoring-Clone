export async function GET() {
 return Response.redirect(new URL('/login',process.env.MENTORING_SITE_URL || 'https://mentoring-clone-map.vercel.app'));
}
