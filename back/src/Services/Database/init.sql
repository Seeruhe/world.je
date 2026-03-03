-- WorkAdventure Database Schema
-- This file is automatically executed when PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- User Wallet Table
-- Stores wallet addresses and authentication data
-- ============================================
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    nonce VARCHAR(64),
    chain_id INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast wallet lookups
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_created_at ON user_wallets(created_at);

-- ============================================
-- User Profile Table
-- Stores user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    username VARCHAR(50),
    display_name VARCHAR(100),
    avatar_url TEXT,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_id)
);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet_id ON user_profiles(wallet_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_points ON user_profiles(points DESC);

-- ============================================
-- Invite Code Table
-- Stores invite codes created by users
-- ============================================
CREATE TABLE IF NOT EXISTS invite_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(12) UNIQUE NOT NULL,
    creator_wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    max_uses INTEGER DEFAULT -1,  -- -1 means unlimited
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_creator ON invite_codes(creator_wallet_id);

-- ============================================
-- Invite Record Table
-- Tracks who invited whom
-- ============================================
CREATE TABLE IF NOT EXISTS invite_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_code_id UUID REFERENCES invite_codes(id) ON DELETE CASCADE,
    inviter_wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    invitee_wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    reward_claimed BOOLEAN DEFAULT FALSE,
    reward_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(invitee_wallet_id)  -- Each user can only be invited once
);

-- Index for invite record lookups
CREATE INDEX IF NOT EXISTS idx_invite_records_code ON invite_records(invite_code_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_inviter ON invite_records(inviter_wallet_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_invitee ON invite_records(invitee_wallet_id);

-- ============================================
-- AI NPC Configuration Table
-- Stores AI NPC settings for different rooms
-- ============================================
CREATE TABLE IF NOT EXISTS ai_npc_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    npc_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    system_prompt TEXT,
    greeting TEXT,
    model VARCHAR(100) DEFAULT 'glm-5',
    room_url TEXT,
    position_x INTEGER,
    position_y INTEGER,
    trigger_distance INTEGER DEFAULT 64,
    texture VARCHAR(100),
    personality TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for NPC lookups
CREATE INDEX IF NOT EXISTS idx_ai_npc_configs_npc_id ON ai_npc_configs(npc_id);
CREATE INDEX IF NOT EXISTS idx_ai_npc_configs_room ON ai_npc_configs(room_url);

-- ============================================
-- AI Trigger Zone Table
-- Stores AI trigger zone settings
-- ============================================
CREATE TABLE IF NOT EXISTS ai_trigger_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    room_url TEXT NOT NULL,
    system_prompt TEXT,
    greeting TEXT,
    auto_open BOOLEAN DEFAULT TRUE,
    model VARCHAR(100) DEFAULT 'glm-5',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for zone lookups
CREATE INDEX IF NOT EXISTS idx_ai_trigger_zones_zone_id ON ai_trigger_zones(zone_id);
CREATE INDEX IF NOT EXISTS idx_ai_trigger_zones_room ON ai_trigger_zones(room_url);

-- ============================================
-- NFT Badge Table
-- Stores available NFT badges
-- ============================================
CREATE TABLE IF NOT EXISTS nft_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    contract_address VARCHAR(42),
    token_id VARCHAR(78),
    rarity VARCHAR(20) DEFAULT 'common',  -- common, rare, epic, legendary
    metadata JSONB DEFAULT '{}',
    criteria JSONB DEFAULT '{}',  -- Conditions to earn this badge
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for badge lookups
CREATE INDEX IF NOT EXISTS idx_nft_badges_badge_id ON nft_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_nft_badges_rarity ON nft_badges(rarity);

-- ============================================
-- User Badge Table
-- Tracks badges owned by users
-- ============================================
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES nft_badges(id) ON DELETE CASCADE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_displayed BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(wallet_id, badge_id)
);

-- Index for user badge lookups
CREATE INDEX IF NOT EXISTS idx_user_badges_wallet_id ON user_badges(wallet_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- ============================================
-- AI Conversation History Table
-- Stores conversation history with AI NPCs
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    npc_id VARCHAR(100),
    zone_id VARCHAR(100),
    session_id UUID,
    role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_ai_conversations_wallet_id ON ai_conversations(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id);

-- ============================================
-- Points Transaction Table
-- Tracks points earned/spent
-- ============================================
CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES user_wallets(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,  -- Positive for earning, negative for spending
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,  -- 'invite_reward', 'badge_reward', 'ai_interaction', etc.
    reference_id UUID,  -- Reference to related entity (invite, badge, etc.)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for transaction lookups
CREATE INDEX IF NOT EXISTS idx_points_transactions_wallet_id ON points_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(transaction_type);

-- ============================================
-- Insert Default Badges
-- ============================================
INSERT INTO nft_badges (badge_id, name, description, rarity, criteria) VALUES
    ('early_adopter', 'Early Adopter', 'One of the first 1000 users to join WorkAdventure', 'legendary', '{"max_users": 1000}'),
    ('first_invite', 'First Invitation', 'Successfully invited your first friend', 'common', '{"invites_required": 1}'),
    ('super_inviter', 'Super Inviter', 'Invited 10 or more friends', 'epic', '{"invites_required": 10}'),
    ('mega_inviter', 'Mega Inviter', 'Invited 50 or more friends', 'legendary', '{"invites_required": 50}'),
    ('ai_explorer', 'AI Explorer', 'Interacted with AI NPCs 10 times', 'rare', '{"ai_interactions_required": 10}'),
    ('ai_master', 'AI Master', 'Interacted with AI NPCs 100 times', 'legendary', '{"ai_interactions_required": 100}'),
    ('verified_user', 'Verified User', 'Completed identity verification', 'rare', '{"verification_required": true}')
ON CONFLICT (badge_id) DO NOTHING;

-- ============================================
-- Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers for updated_at
CREATE TRIGGER update_user_wallets_updated_at
    BEFORE UPDATE ON user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_npc_configs_updated_at
    BEFORE UPDATE ON ai_npc_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Function to add points with transaction recording
-- ============================================
CREATE OR REPLACE FUNCTION add_points(
    p_wallet_id UUID,
    p_amount INTEGER,
    p_transaction_type VARCHAR(50),
    p_reference_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
    v_profile_exists INTEGER;
BEGIN
    -- Check if profile exists
    SELECT COUNT(*) INTO v_profile_exists
    FROM user_profiles WHERE wallet_id = p_wallet_id;

    IF v_profile_exists = 0 THEN
        RETURN -1;  -- Profile not found
    END IF;

    -- Update points
    UPDATE user_profiles
    SET points = points + p_amount,
        level = LEAST(100, 1 + FLOOR((points + p_amount) / 100.0))
    WHERE wallet_id = p_wallet_id
    RETURNING points INTO v_new_balance;

    -- Record transaction
    INSERT INTO points_transactions (
        wallet_id, amount, balance_after, transaction_type, reference_id, metadata
    ) VALUES (
        p_wallet_id, p_amount, v_new_balance, p_transaction_type, p_reference_id, p_metadata
    );

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to check and award badges
-- ============================================
CREATE OR REPLACE FUNCTION check_and_award_badges(p_wallet_id UUID)
RETURNS TABLE(badge_id VARCHAR(100), badge_name VARCHAR(100)) AS $$
DECLARE
    v_invite_count INTEGER;
    v_ai_interaction_count INTEGER;
    v_user_count INTEGER;
BEGIN
    -- Get user stats
    SELECT COUNT(*) INTO v_invite_count
    FROM invite_records WHERE inviter_wallet_id = p_wallet_id;

    SELECT COUNT(*) INTO v_ai_interaction_count
    FROM ai_conversations WHERE wallet_id = p_wallet_id AND role = 'user';

    -- Check invite badges
    IF v_invite_count >= 1 THEN
        INSERT INTO user_badges (wallet_id, badge_id)
        SELECT p_wallet_id, id FROM nft_badges WHERE badge_id = 'first_invite'
        ON CONFLICT (wallet_id, badge_id) DO NOTHING
        RETURNING (SELECT badge_id FROM nft_badges WHERE id = user_badges.badge_id),
                  (SELECT name FROM nft_badges WHERE id = user_badges.badge_id);
    END IF;

    IF v_invite_count >= 10 THEN
        INSERT INTO user_badges (wallet_id, badge_id)
        SELECT p_wallet_id, id FROM nft_badges WHERE badge_id = 'super_inviter'
        ON CONFLICT (wallet_id, badge_id) DO NOTHING;
    END IF;

    IF v_invite_count >= 50 THEN
        INSERT INTO user_badges (wallet_id, badge_id)
        SELECT p_wallet_id, id FROM nft_badges WHERE badge_id = 'mega_inviter'
        ON CONFLICT (wallet_id, badge_id) DO NOTHING;
    END IF;

    -- Check AI interaction badges
    IF v_ai_interaction_count >= 10 THEN
        INSERT INTO user_badges (wallet_id, badge_id)
        SELECT p_wallet_id, id FROM nft_badges WHERE badge_id = 'ai_explorer'
        ON CONFLICT (wallet_id, badge_id) DO NOTHING;
    END IF;

    IF v_ai_interaction_count >= 100 THEN
        INSERT INTO user_badges (wallet_id, badge_id)
        SELECT p_wallet_id, id FROM nft_badges WHERE badge_id = 'ai_master'
        ON CONFLICT (wallet_id, badge_id) DO NOTHING;
    END IF;

    RETURN;
END;
$$ LANGUAGE plpgsql;
