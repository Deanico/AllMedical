-- Add Projects & Tasks Feature
-- This enables project management with goals and progress tracking

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  deadline DATE,
  goal VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'completed', 'blocked')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Goals Table
CREATE TABLE IF NOT EXISTS daily_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  revenue_goal NUMERIC(10, 2),
  shipments_goal INTEGER,
  tasks_goal INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_daily_goals_date ON daily_goals(date);

-- Function to get project progress
CREATE OR REPLACE FUNCTION get_project_progress(project_uuid UUID)
RETURNS TABLE(
  total_tasks INTEGER,
  completed_tasks INTEGER,
  progress_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed_tasks,
    ROUND(
      CASE 
        WHEN COUNT(*) > 0 THEN 
          (COUNT(CASE WHEN status = 'completed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100
        ELSE 0
      END,
      1
    ) as progress_percentage
  FROM tasks
  WHERE project_id = project_uuid;
END;
$$ LANGUAGE plpgsql;

-- View for project overview
CREATE OR REPLACE VIEW project_overview AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.deadline,
  p.goal,
  p.status,
  p.created_at,
  COUNT(t.id) as total_tasks,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
  ROUND(
    CASE 
      WHEN COUNT(t.id) > 0 THEN 
        (COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::NUMERIC / COUNT(t.id)::NUMERIC) * 100
      ELSE 0
    END,
    1
  ) as progress_percentage
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.description, p.deadline, p.goal, p.status, p.created_at
ORDER BY p.created_at DESC;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data
INSERT INTO projects (name, description, deadline, goal, status)
VALUES 
  ('Business Growth Q1', 'Expand client base and improve operational efficiency', '2026-03-31', 'Reach 50 active clients', 'active'),
  ('Website Improvements', 'Enhance admin dashboard and user experience', '2026-04-15', 'Complete all UI updates', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO daily_goals (date, revenue_goal, shipments_goal, tasks_goal, notes)
VALUES 
  (CURRENT_DATE, 5000.00, 10, 8, 'Focus on high-value clients')
ON CONFLICT (date) DO UPDATE 
SET revenue_goal = EXCLUDED.revenue_goal,
    shipments_goal = EXCLUDED.shipments_goal,
    tasks_goal = EXCLUDED.tasks_goal,
    notes = EXCLUDED.notes;

-- Grant permissions (adjust role name as needed)
-- GRANT ALL ON projects, tasks, daily_goals TO your_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Projects & Tasks tables created successfully!
