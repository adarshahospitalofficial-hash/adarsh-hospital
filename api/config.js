module.exports = (req, res) => {
  res.status(200).json({
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: ""
  });
};

