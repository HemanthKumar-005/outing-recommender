/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
<<<<<<< HEAD
  poweredByHeader: false,
=======
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        pathname: "/maps/api/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com",
      },
    ],
  },
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
};

module.exports = nextConfig;
