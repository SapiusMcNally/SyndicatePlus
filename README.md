# Syndicate+

An intelligent platform for boutique corporate finance firms to build optimal syndicates for capital raising transactions.

## Overview

Syndicate+ connects boutique corporate finance and capital introduction firms, enabling them to intelligently build syndicates that maximize deal completion success. The platform uses AI-powered matching algorithms to recommend the most suitable syndicate partners based on investor base profiles, sector expertise, deal size, and jurisdictions.

## Key Features

### 1. Member Firm Management
- Secure registration and authentication
- Detailed firm profiles including:
  - Investor base jurisdictions
  - Typical deal size ranges
  - Sector focus areas
  - Recent transaction history

### 2. Deal-Locker System
- Create confidential deal rooms for transactions
- Specify deal parameters (amount, sector, type, jurisdiction)
- Track deal status and syndicate formation progress
- Controlled access with eNDA requirements

### 3. Intelligent Syndicate Matching
- AI-powered algorithm analyzes firm profiles
- Matches deals with most suitable syndicate partners
- Provides match scores and detailed reasoning
- Customizable syndicate size

### 4. Invitation Management
- Send personalized invitations to potential syndicate members
- Track invitation status (pending, accepted, declined)
- Two-way invitation system (sent and received)

### 5. eNDA Workflow
- Electronic Non-Disclosure Agreement signing
- Required before granting deal-locker access
- Automatic access control based on NDA status

### 6. Dashboard & Analytics
- Overview of active deals
- Syndicate member tracking
- Invitation management
- Quick actions and notifications

## Technology Stack

### Backend
- **Node.js** with Express.js
- **JWT** for authentication
- **bcryptjs** for password hashing
- **In-memory database** (development) - ready for MongoDB/PostgreSQL integration

### Frontend
- **Vanilla JavaScript** (ES6+)
- **HTML5** & **CSS3**
- **Font Awesome** icons
- Responsive design

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Edit `.env` file with your settings:
   ```
   PORT=3000
   JWT_SECRET=your_secret_key_here
   NODE_ENV=development
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`

## Usage Guide

### Getting Started

1. **Register Your Firm**
   - Click "Sign Up" on the homepage
   - Enter firm details and create an account
   - You'll be automatically logged in

2. **Complete Your Profile**
   - Navigate to "Firm Profile" in the dashboard
   - Add jurisdictions, deal size ranges, and sector focus
   - List recent transactions to improve matching

3. **Create a Deal**
   - Click "Create Deal" in the sidebar
   - Enter deal details (name, amount, sector, jurisdiction)
   - Specify target investor profile

### Building Your Syndicate

1. **Get Recommendations**
   - Go to "Build Syndicate"
   - Select the deal you want to syndicate
   - Choose number of firms needed
   - Click "Get AI Recommendations"

2. **Review Matches**
   - Review the recommended firms with match scores
   - See detailed reasons for each match
   - Select firms you want to invite

3. **Send Invitations**
   - Click "Send Invitations to Selected Firms"
   - Personalized invitations are sent to each firm
   - Track responses in the Invitations section

### Managing Invitations

**Received Invitations:**
- View deal details and inviting firm
- Accept and sign eNDA to join syndicate
- Decline if not interested

**Sent Invitations:**
- Track status of invitations you've sent
- See which firms have accepted or declined

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new firm
- `POST /api/auth/login` - Login

### Firms
- `GET /api/firms/profile/:id` - Get firm profile
- `PUT /api/firms/profile` - Update firm profile
- `GET /api/firms/all` - Get all firms (for syndicate building)

### Deals
- `POST /api/deals/create` - Create new deal
- `GET /api/deals/my-deals` - Get firm's deals
- `GET /api/deals/invited` - Get deals where firm is invited
- `GET /api/deals/:id` - Get single deal
- `PUT /api/deals/:id` - Update deal

### Syndicate
- `POST /api/syndicate/recommend` - Get syndicate recommendations
- `POST /api/syndicate/build` - Save syndicate selections

### Invitations
- `POST /api/invitations/send` - Send invitation
- `GET /api/invitations/received` - Get received invitations
- `GET /api/invitations/sent` - Get sent invitations
- `POST /api/invitations/respond` - Accept or decline invitation

## Matching Algorithm

The intelligent matching algorithm scores firms based on:

1. **Jurisdiction Match (30 points)** - Firm operates in deal's jurisdiction
2. **Sector Expertise (35 points)** - Firm specializes in deal's sector
3. **Deal Size Compatibility (25 points)** - Deal fits firm's typical range
4. **Track Record (10 points)** - Firm has recent transaction activity

Match scores range from 0-100%, with detailed reasoning provided for each recommendation.

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Protected API routes with middleware
- Session management with localStorage
- eNDA requirement before deal access

## Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- File upload for deal documents
- Real-time notifications
- Email integration
- Advanced analytics and reporting
- Multi-factor authentication
- Mobile app

## Project Structure

```
Syndicate+/
├── public/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # Styling
│   └── app.js          # Frontend JavaScript
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── firms.js        # Firm management routes
│   ├── deals.js        # Deal management routes
│   ├── syndicate.js    # Syndicate building routes
│   └── invitations.js  # Invitation management routes
├── middleware/
│   └── auth.js         # Authentication middleware
├── server.js           # Express server
├── package.json        # Dependencies
├── .env                # Environment variables
└── README.md           # This file
```

## Support

For issues or questions, please contact the development team.

## License

Proprietary - All rights reserved

---

Built with ❤️ for the corporate finance community
