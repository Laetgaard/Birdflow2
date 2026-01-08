-- Migration: Seed default email templates for all websites
-- This migration ensures every website has the 5 default email template types
-- It will NOT overwrite existing customized templates (uses INSERT ON CONFLICT DO NOTHING)

-- Backfill: Insert default templates for all existing websites that are missing them
INSERT INTO email_templates (id, website_id, template_type, subject, heading, body_text, button_text, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    w.id,
    template.type,
    template.subject,
    template.heading,
    template.body_text,
    template.button_text,
    NOW(),
    NOW()
FROM websites w
CROSS JOIN (
    VALUES 
        ('order_confirmation', 'Order Confirmation - #{{orderId}}', 'Thank you for your order!', 'We have received your order and are processing it. You will receive another email when your order ships.', 'View Order'),
        ('booking_confirmation', 'Booking Confirmation - {{serviceName}}', 'Your booking is confirmed!', 'We look forward to seeing you at your scheduled appointment.', 'View Booking'),
        ('booking_updated', 'Booking Updated - {{serviceName}}', 'Your booking has been updated', 'The details of your booking have been modified. Please review the updated information below.', 'View Booking'),
        ('booking_cancelled', 'Booking Cancelled - {{serviceName}}', 'Your booking has been cancelled', 'Your booking has been cancelled as requested. If you have any questions, please contact us.', NULL),
        ('website_published', 'Your website is now live!', 'Congratulations! Your website is published', 'Your website is now live and accessible to the world. Click below to visit your site.', 'Visit Website')
) AS template(type, subject, heading, body_text, button_text)
WHERE NOT EXISTS (
    SELECT 1 FROM email_templates et 
    WHERE et.website_id = w.id AND et.template_type = template.type
);

-- Create a trigger function to auto-create default templates for new websites
CREATE OR REPLACE FUNCTION create_default_email_templates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_templates (id, website_id, template_type, subject, heading, body_text, button_text, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), NEW.id, 'order_confirmation', 'Order Confirmation - #{{orderId}}', 'Thank you for your order!', 'We have received your order and are processing it. You will receive another email when your order ships.', 'View Order', NOW(), NOW()),
        (gen_random_uuid(), NEW.id, 'booking_confirmation', 'Booking Confirmation - {{serviceName}}', 'Your booking is confirmed!', 'We look forward to seeing you at your scheduled appointment.', 'View Booking', NOW(), NOW()),
        (gen_random_uuid(), NEW.id, 'booking_updated', 'Booking Updated - {{serviceName}}', 'Your booking has been updated', 'The details of your booking have been modified. Please review the updated information below.', 'View Booking', NOW(), NOW()),
        (gen_random_uuid(), NEW.id, 'booking_cancelled', 'Booking Cancelled - {{serviceName}}', 'Your booking has been cancelled', 'Your booking has been cancelled as requested. If you have any questions, please contact us.', NULL, NOW(), NOW()),
        (gen_random_uuid(), NEW.id, 'website_published', 'Your website is now live!', 'Congratulations! Your website is published', 'Your website is now live and accessible to the world. Click below to visit your site.', 'Visit Website', NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_create_default_email_templates ON websites;

-- Create the trigger
CREATE TRIGGER trigger_create_default_email_templates
    AFTER INSERT ON websites
    FOR EACH ROW
    EXECUTE FUNCTION create_default_email_templates();

-- Add unique constraint if not exists (prevents duplicates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_templates_website_id_template_type_unique'
    ) THEN
        ALTER TABLE email_templates 
        ADD CONSTRAINT email_templates_website_id_template_type_unique 
        UNIQUE (website_id, template_type);
    END IF;
END $$;
