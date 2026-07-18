import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "../models/User";
import Category from "../models/Category";
import Product from "../models/Product";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/buildwise-ai";

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

const products = [
  // CPU
  {
    name: "AMD Ryzen 7 7800X3D",
    brand: "AMD",
    category: "CPU",
    price: 369,
    description:
      "8-core, 16-thread desktop processor with 3D V-Cache for elite gaming performance.",
    images: ["https://placehold.co/600x600?text=Ryzen+7800X3D"],
    specifications: {
      cores: 8,
      threads: 16,
      baseClock: "4.2 GHz",
      boostClock: "5.0 GHz",
      socket: "AM5",
      tdp: 120,
    },
    stock: 25,
  },
  {
    name: "Intel Core i7-14700K",
    brand: "Intel",
    category: "CPU",
    price: 399,
    description:
      "20-core hybrid architecture processor for gaming and productivity.",
    images: ["https://placehold.co/600x600?text=i7-14700K"],
    specifications: {
      cores: 20,
      threads: 28,
      baseClock: "3.4 GHz",
      boostClock: "5.6 GHz",
      socket: "LGA1700",
      tdp: 253,
    },
    stock: 18,
  },
  {
    name: "AMD Ryzen 5 7600",
    brand: "AMD",
    category: "CPU",
    price: 199,
    description:
      "6-core, 12-thread processor — excellent value for mid-range builds.",
    images: ["https://placehold.co/600x600?text=Ryzen+5+7600"],
    specifications: {
      cores: 6,
      threads: 12,
      baseClock: "3.8 GHz",
      boostClock: "5.1 GHz",
      socket: "AM5",
      tdp: 65,
    },
    stock: 40,
  },

  // GPU
  {
    name: "NVIDIA GeForce RTX 4070 Ti Super",
    brand: "NVIDIA",
    category: "GPU",
    price: 799,
    description:
      "16GB GDDR6X GPU for 1440p and 4K gaming with DLSS 3 and ray tracing.",
    images: ["https://placehold.co/600x600?text=RTX+4070+Ti+Super"],
    specifications: {
      vram: "16GB GDDR6X",
      boostClock: "2.61 GHz",
      cudaCores: 8448,
      tdp: 285,
      length: "304mm",
    },
    stock: 12,
  },
  {
    name: "AMD Radeon RX 7900 XTX",
    brand: "AMD",
    category: "GPU",
    price: 899,
    description:
      "24GB GDDR6 flagship GPU — competitive with RTX 4080 at a lower price.",
    images: ["https://placehold.co/600x600?text=RX+7900+XTX"],
    specifications: {
      vram: "24GB GDDR6",
      boostClock: "2.5 GHz",
      streamProcessors: 6144,
      tdp: 355,
      length: "287mm",
    },
    stock: 8,
  },
  {
    name: "NVIDIA GeForce RTX 4060",
    brand: "NVIDIA",
    category: "GPU",
    price: 299,
    description:
      "8GB GPU for solid 1080p and entry 1440p gaming with excellent efficiency.",
    images: ["https://placehold.co/600x600?text=RTX+4060"],
    specifications: {
      vram: "8GB GDDR6",
      boostClock: "2.46 GHz",
      cudaCores: 3072,
      tdp: 115,
      length: "240mm",
    },
    stock: 30,
  },

  // Motherboard
  {
    name: "MSI MAG B650 TOMAHAWK WiFi",
    brand: "MSI",
    category: "Motherboard",
    price: 219,
    description:
      "AM5 DDR5 motherboard with WiFi 6E, 2.5G LAN, and robust VRM.",
    images: ["https://placehold.co/600x600?text=B650+Tomahawk"],
    specifications: {
      socket: "AM5",
      chipset: "B650",
      formFactor: "ATX",
      memorySlots: 4,
      maxMemory: 128,
      m2Slots: 2,
    },
    stock: 20,
  },
  {
    name: "ASUS ROG STRIX Z790-E Gaming WiFi",
    brand: "ASUS",
    category: "Motherboard",
    price: 349,
    description:
      "Premium Z790 board with DDR5, PCIe 5.0, and extensive connectivity.",
    images: ["https://placehold.co/600x600?text=Z790-E"],
    specifications: {
      socket: "LGA1700",
      chipset: "Z790",
      formFactor: "ATX",
      memorySlots: 4,
      maxMemory: 128,
      m2Slots: 4,
    },
    stock: 10,
  },

  // RAM
  {
    name: "G.Skill Trident Z5 RGB 32GB (2x16)",
    brand: "G.Skill",
    category: "RAM",
    price: 109,
    description: "DDR5-6000 CL30 memory kit with RGB lighting.",
    images: ["https://placehold.co/600x600?text=Trident+Z5"],
    specifications: {
      capacity: "32GB (2x16GB)",
      speed: "DDR5-6000",
      cas: 30,
      voltage: "1.35V",
    },
    stock: 50,
  },
  {
    name: "Corsair Vengeance LPX 32GB (2x16)",
    brand: "Corsair",
    category: "RAM",
    price: 69,
    description: "DDR4-3200 CL16 low-profile memory — reliable and affordable.",
    images: ["https://placehold.co/600x600?text=Vengeance+LPX"],
    specifications: {
      capacity: "32GB (2x16GB)",
      speed: "DDR4-3200",
      cas: 16,
      voltage: "1.35V",
    },
    stock: 60,
  },

  // SSD
  {
    name: "Samsung 990 Pro 2TB NVMe",
    brand: "Samsung",
    category: "SSD",
    price: 179,
    description:
      "PCIe 4.0 NVMe SSD with up to 7,450 MB/s read — top-tier performance.",
    images: ["https://placehold.co/600x600?text=990+Pro"],
    specifications: {
      capacity: "2TB",
      interface: "PCIe 4.0 NVMe",
      readSpeed: "7,450 MB/s",
      writeSpeed: "6,900 MB/s",
      formFactor: "M.2 2280",
    },
    stock: 35,
  },
  {
    name: "WD Black SN770 1TB NVMe",
    brand: "Western Digital",
    category: "SSD",
    price: 79,
    description: "Budget-friendly PCIe 4.0 SSD with solid gaming performance.",
    images: ["https://placehold.co/600x600?text=SN770"],
    specifications: {
      capacity: "1TB",
      interface: "PCIe 4.0 NVMe",
      readSpeed: "5,150 MB/s",
      writeSpeed: "4,900 MB/s",
      formFactor: "M.2 2280",
    },
    stock: 45,
  },

  // HDD
  {
    name: "Seagate Barracuda 2TB",
    brand: "Seagate",
    category: "HDD",
    price: 54,
    description: "7200 RPM internal hard drive for bulk storage.",
    images: ["https://placehold.co/600x600?text=Barracuda+2TB"],
    specifications: {
      capacity: "2TB",
      rpm: 7200,
      interface: "SATA III",
      cache: "256MB",
    },
    stock: 40,
  },

  // PSU
  {
    name: "Corsair RM850x 850W 80+ Gold",
    brand: "Corsair",
    category: "PSU",
    price: 149,
    description:
      "Fully modular 850W power supply with 80 Plus Gold efficiency and zero-RPM fan mode.",
    images: ["https://placehold.co/600x600?text=RM850x"],
    specifications: {
      wattage: 850,
      efficiency: "80+ Gold",
      modular: "Fully",
      fanSize: "135mm",
      warranty: 10,
    },
    stock: 22,
  },
  {
    name: "EVGA SuperNOVA 750 G7",
    brand: "EVGA",
    category: "PSU",
    price: 109,
    description: "Compact fully modular 750W PSU for mid-range builds.",
    images: ["https://placehold.co/600x600?text=750+G7"],
    specifications: {
      wattage: 750,
      efficiency: "80+ Gold",
      modular: "Fully",
      fanSize: "135mm",
      warranty: 10,
    },
    stock: 15,
  },

  // Case
  {
    name: "Lian Li O11 Dynamic EVO",
    brand: "Lian Li",
    category: "Case",
    price: 169,
    description:
      "Versatile dual-chamber case with excellent airflow and modular design.",
    images: ["https://placehold.co/600x600?text=O11+EVO"],
    specifications: {
      formFactor: "ATX / mATX / ITX",
      maxGpuLength: "422mm",
      maxCoolerHeight: "167mm",
      fanSupport: "10x 120mm",
      radiators: "Up to 360mm",
    },
    stock: 14,
  },
  {
    name: "NZXT H5 Flow",
    brand: "NZXT",
    category: "Case",
    price: 94,
    description:
      "Clean airflow-focused mid-tower with perforated front panel.",
    images: ["https://placehold.co/600x600?text=H5+Flow"],
    specifications: {
      formFactor: "ATX / mATX / ITX",
      maxGpuLength: "365mm",
      maxCoolerHeight: "165mm",
      fanSupport: "4x 120mm",
      radiators: "Up to 280mm",
    },
    stock: 20,
  },

  // Cooler
  {
    name: "Noctua NH-D15 chromax.black",
    brand: "Noctua",
    category: "Cooler",
    price: 109,
    description:
      "Dual-tower air cooler with two NF-A15 fans — legendary quiet cooling.",
    images: ["https://placehold.co/600x600?text=NH-D15"],
    specifications: {
      type: "Air (Dual Tower)",
      fans: "2x NF-A15 PWM",
      height: "165mm",
      tdpRating: "250W+",
    },
    stock: 18,
  },
  {
    name: "Arctic Liquid Freezer II 280",
    brand: "Arctic",
    category: "Cooler",
    price: 89,
    description: "280mm AIO liquid cooler with excellent price-to-performance.",
    images: ["https://placehold.co/600x600?text=Freezer+II+280"],
    specifications: {
      type: "AIO Liquid",
      radiatorSize: "280mm",
      fans: "2x P14 PWM",
      tdpRating: "300W+",
    },
    stock: 22,
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

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

    console.log("\nSeed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
