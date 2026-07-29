import User from "../models/User.js";

const getMe = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    res.status(200).json({
      success: true,
      user: {
        uid: req.user.uid,
        email: user?.email ?? req.user.email ?? null,
        provider: req.user.firebase?.sign_in_provider,
        guest: user?.guest ?? false,
        premium: user?.premium ?? false,
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