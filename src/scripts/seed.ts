import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import User from "../models/User";
import Category from "../models/Category";
import Product from "../models/Product";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run seed script in production environment");
  process.exit(1);
}

const categories = [
  { name: "CPU", slug: "cpu", icon: "cpu" },
  { name: "GPU", slug: "gpu", icon: "monitor" },
  { name: "Motherboard", slug: "motherboard", icon: "circuit-board" },
  { name: "RAM", slug: "ram", icon: "memory-stick" },
  { name: "SSD", slug: "ssd", icon: "hard-drive" },
  { name: "HDD", slug: "hdd", icon: "hard-drive" },
  { name: "PSU", slug: "psu", icon: "zap" },
  { name: "Case", slug: "case", icon: "box" },
  { name: "Cooler", slug: "cooler", icon: "thermometer" },
];

// Read products from the client's public/products-seed.json
const seedJsonPath = path.resolve(
  __dirname,
  "../../../buildwise-ai-client/public/products-seed.json"
);
const products = JSON.parse(fs.readFileSync(seedJsonPath, "utf-8"));

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI!);
    const dbName = mongoose.connection.db?.databaseName || "unknown";
    console.log(`Connected to MongoDB — database: "${dbName}"`);

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log("Cleared existing data");

    // Create admin user
    const admin = await User.create({
      name: "Admin",
      email: "admin@buildwise.com",
      role: "admin",
    });
    console.log(`Admin user created: ${admin.email}`);

    // Create categories
    const createdCategories = await Category.insertMany(categories);
    console.log(`${createdCategories.length} categories created`);

    // Create products
    const createdProducts = await Product.insertMany(products);
    console.log(`${createdProducts.length} products created`);

    // Log a sample product to verify images are set correctly
    const sample = createdProducts[0];
    console.log(
      `\nSample product: ${sample.name} — images: ${JSON.stringify(sample.images)}`
    );

    console.log("\nSeed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
