import { User } from "../models/user";

export const getCurrentUser = async (reqUser: any) => {
  User.findOne({ firebaseUID: reqUser?.id });
  return;
};

export const updateProfile = async (reqUser: any, { fullName, email }) => {
  return User.findOneAndUpdate(
    { firebaseUID: reqUser?.id },
    { fullName, email },
    { new: true }
  );
};
