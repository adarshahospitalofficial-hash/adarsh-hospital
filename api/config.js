module.exports = (req, res) => {
  // Return connection config referencing the Vercel rewrite proxy path
  res.status(200).json({
    SUPABASE_URL: "/db",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
  });
};
