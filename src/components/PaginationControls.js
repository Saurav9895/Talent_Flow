import "./PaginationControls.css";

function PaginationControls({ page, totalPages, onPageChange }) {
  return (
    <div className="pagination-controls">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="pagination-button"
      >
        Previous
      </button>
      <span className="pagination-info">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="pagination-button"
      >
        Next
      </button>
    </div>
  );
}

export default PaginationControls;
