# 🪙 Budgetcap — Zero-Based Envelope Budgeting App

Budgetcap is a modern, full-stack personal finance and budgeting application built on the principles of **Zero-Based Envelope Budgeting**. It helps households plan their spending, allocate funds to specific categories (envelopes), track real-time balances, and manage accounts and transactions in a shared household environment.

Designed for multi-user collaboration within a household, this application features a sleek responsive UI with light/dark theme support, smooth drag-and-drop budget organizing, and decimal-free currency calculations to ensure high precision and reliability.

---

## 🚀 Features

### 🔐 1. Authentication & Household Sharing
*   **Secure Authentication**: Secure user registration and login powered by **NextAuth.js v5** (using bcrypt for password hashing).
*   **Household Concept**: Users belong to a "Household". Multiple family members can log in and share the same budget, envelopes, and transaction lists in real time.

### 🏦 2. Account Management
*   **Multi-Account Tracking**: Support for three types of real-world financial accounts:
    *   `CHECKING` (Daily transaction account)
    *   `SAVINGS` (Savings and goal funds)
    *   `CASH` (Cash-on-hand or physical wallets)
*   **Default Accounts**: Easily designate a primary account for quick transaction entry.
*   **Interactive Drag & Drop**: Reorder accounts to customize your sidebar or dashboard overview.

### ✉️ 3. Zero-Based Envelope Budgeting
*   **Envelope Sets**: Group envelopes into logical sections (e.g., Monthly Expenses, Annual Funds, Special Projects).
*   **Budget Period Settings**: Customize when a budget month starts for each Envelope Set (e.g., the 1st of the month, or aligned with a custom payday).
*   **Allocations**: Allocate a specific portion of your income to envelopes on a monthly basis.
*   **Rollovers**: Available balances automatically roll over from previous months, calculating the cumulative budget status.
*   **Drag-and-Drop Sorting**: Seamlessly reorder both Envelope Sets and individual Envelopes using `@dnd-kit`.

### 🎯 4. Goal Tracking
*   **Goal Envelopes**: Toggle any envelope to function as a savings goal.
*   **Goal Amount & Deadlines**: Set target amounts and target dates for specific milestones.
*   **Visual Progress**: Track how close you are to completing the goal relative to the total envelope balance.

### 💸 5. Transactions & Transfers
*   **Three Transaction Types**:
    *   `INCOME`: Credit money to accounts and assign it to "Unallocated" or specific envelopes.
    *   `EXPENSE`: Log spending from a chosen account and envelope.
    *   `TRANSFER`: Move money between two accounts (Account Transfer) or two envelopes (Envelope Transfer).
*   **Recurring Transactions**: Create recurring transaction templates that automatically copy and generate on a specified day of the month.
*   **Transaction Logs**: Filter and view historical transactions by envelope, date range, or account.

### 📈 6. Analytical Reports
*   **Visual Insights**: View charts and breakdowns of spending habits, income vs. expenses, and budget allocation distributions to optimize your financial plans.

### 🌓 7. Premium Dark & Light UI
*   **Dynamic Theme Toggle**: Clean light and dark modes powered by `next-themes` and styled with TailwindCSS and Radix UI primitives.
*   **Responsive Layout**: Fits beautifully on desktop, tablet, and mobile screens.

---

## 🛠️ Tech Stack

*   **Frontend Framework**: [Next.js 16 (App Router)](https://nextjs.org/) & React 19
*   **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) & [Prisma ORM](https://www.prisma.io/)
*   **Authentication**: [NextAuth.js v5 (Beta)](https://authjs.dev/)
*   **State & Revalidation**: Next.js Server Actions & cache revalidation pathing
*   **Drag and Drop**: `@dnd-kit/core` & `@dnd-kit/sortable`
*   **Styling**: [TailwindCSS v4](https://tailwindcss.com/) & [Radix UI Primitives](https://www.radix-ui.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Feedback & Toasts**: `sonner`

---

## 📐 Database Architecture

The database model is configured in PostgreSQL using Prisma. 

```mermaid
erDiagram
    User ||--o{ HouseholdMember : "belongs to"
    User ||--o{ Household : "owns"
    Household ||--o{ HouseholdMember : "has"
    Household ||--o{ Account : "owns"
    Household ||--o{ EnvelopeSet : "owns"
    Household ||--o{ Transaction : "records"
    
    Account ||--o{ EnvelopeSet : "linked to"
    Account ||--o{ Transaction : "primary source"
    Account ||--o{ Transaction : "transfer destination"
    
    EnvelopeSet ||--o{ Envelope : "contains"
    
    Envelope ||--o{ Allocation : "has monthly"
    Envelope ||--o{ Transaction : "debited from"
    Envelope ||--o{ Transaction : "credited to (transfers)"
```

### Key Technical Decisions:
1.  **Paise-Based Currency**: All monetary values (`amountInPaise`, `openingBalanceInPaise`, `goalAmountInPaise`) are stored as **integers representing Paise** (1 Rupee = 100 Paise). Storing currency as integers completely avoids the floating-point inaccuracies (`0.1 + 0.2 !== 0.3`) typical of float/double database columns.
2.  **Cascading Deletes**: When a household is deleted, all associated accounts, envelopes, allocations, and transactions cascade and delete automatically.
3.  **Unique Constraints**: Envelopes can only have one allocation per month/year, enforced by a composite unique index: `@@unique([envelopeId, month, year])`.

---

## 📁 Project Directory Structure

```text
├── app/
│   ├── (auth)/                   # Login, register pages
│   ├── (dashboard)/              # Core pages (budget, accounts, envelopes, transactions, etc.)
│   ├── actions/                  # Next.js Server Actions (auth, accounts, budget, transactions)
│   ├── api/
│   │   ├── auth/[...nextauth]    # NextAuth.js API handlers
│   │   └── cron/recurring        # Trigger endpoint for monthly recurring transactions
│   ├── globals.css               # Global styling, Tailwind imports
│   ├── layout.tsx                # App layout wrapper (Auth & Theme providers)
│   └── page.tsx                  # Home redirect to dashboard
├── components/
│   ├── accounts/                 # Account forms, dialogs, drag-and-drop lists
│   ├── budget/                   # Allocation tables, rollover trackers, forms
│   ├── ui/                       # Shadcn/Radix UI base design components
│   ├── sidebar.tsx               # Sidebar navigation (IndianRupee & links)
│   └── header.tsx                # Navigation header & user status
├── lib/
│   ├── auth-helpers.ts           # Authentication session guards
│   ├── prisma.ts                 # Database client singleton
│   └── utils.ts                  # HSL-Tailwind classes, formatINR, rupeesToPaise
├── prisma/
│   ├── schema.prisma             # DB schemas (User, Household, Account, Transaction, etc.)
│   └── migrations/               # Database migrations folder
├── public/                       # Static assets
└── vercel.json                   # Vercel deployment cron configuration
```

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v20+ recommended)
*   [pnpm](https://pnpm.io/) or `npm`
*   A running PostgreSQL database instance (Supabase, local Postgres, or Docker image)

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone <repository-url>
cd budgetcap
pnpm install # or npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory:
```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:12345678@localhost:5432/budgetcap"

# Cryptographically strong secret key for NextAuth.js
AUTH_SECRET="your-generated-super-secret-key"

# Base URL of the app
NEXTAUTH_URL="http://localhost:3000"

# Optional cron secret for recurring transactions (in production)
CRON_SECRET="your-custom-cron-secret-key"
```

### 4. Database Setup & Migrations
Create your database tables and run the initial migration:
```bash
npx prisma db push # Or run full migrations: npx prisma migrate dev
```

### 5. Running the Application
Start the development server:
```bash
pnpm dev # or npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Register a new account, which will automatically create a default Household, a primary Checking account, and get your budget started!

### 6. Triggering Recurring Transactions
To test the monthly recurring transactions generator in development, you can invoke the GET request:
```bash
curl http://localhost:3000/api/cron/recurring
```
In production, this route requires the authorization header `Authorization: Bearer <CRON_SECRET>`. It is triggered automatically at 6:00 AM on the 1st of every month via the schedule defined in `vercel.json`.

---

## 📜 License
This project is licensed under the MIT License.
