import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { verifyCredentials, ACCESS_TOKEN_MAX_AGE } from "@/lib/auth";
import { userSelect, badRequest, serverError, readJson } from "@/lib/userAdmin";

// Login สำหรับ front-end ที่อยู่คนละโดเมน: คืน access token ไว้ส่งใน header
// Authorization: Bearer <accessToken> (ใช้ secret และรูปแบบเดียวกับ session ของ NextAuth)
export async function POST(request) {
  const body = await readJson(request);
  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  try {
    const { user, error, code } = await verifyCredentials(
      body.username,
      body.password,
    );
    if (error) {
      return NextResponse.json(
        { message: error, code },
        { status: code === "INVALID" ? 401 : 403 },
      );
    }

    const accessToken = await encode({
      token: {
        sub: user.id,
        id: user.id,
        username: user.username,
        role: user.role,
      },
      secret: process.env.NEXTAUTH_SECRET,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    const profile = Object.fromEntries(
      Object.keys(userSelect).map((key) => [key, user[key]]),
    );

    return NextResponse.json({
      message: "เข้าสู่ระบบสำเร็จ",
      data: {
        accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_MAX_AGE,
        expiresAt: new Date(
          Date.now() + ACCESS_TOKEN_MAX_AGE * 1000,
        ).toISOString(),
        user: profile,
      },
    });
  } catch (err) {
    return serverError(err, "Error issuing token:");
  }
}
