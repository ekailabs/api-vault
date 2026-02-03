interface EmptyStateProps {
  className?: string;
  title: string;
  description: string;
  suggestion?: string;
}

export default function EmptyState({ 
  className = '', 
  title,
  description,
  suggestion = "Make some API requests to see data."
}: EmptyStateProps) {
  return (
    <div className={`card p-8 ${className}`}>
      <h3 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h3>
      <div className="text-center text-gray-500 py-8">
        <p className="mb-2">{description}</p>
        <p className="text-sm">{suggestion}</p>
      </div>
    </div>
  );
}