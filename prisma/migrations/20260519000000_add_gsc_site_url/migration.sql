-- Add gscSiteUrl column to User table for storing selected GSC property
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gscSiteUrl" TEXT;
