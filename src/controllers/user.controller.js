const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email || null,
        provider: req.user.firebase?.sign_in_provider,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export { getMe };