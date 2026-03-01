import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { materialsAPI, coursesAPI } from '@/lib/api';
import { Card, Button, Loading, EmptyState, Badge, Modal, Input, TextArea, Select } from '@/components/ui';
import { FileText, Upload, Download, Link as LinkIcon, Trash, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState({ course_id: '', type: '' });
  const [form, setForm] = useState({
    title: '', description: '', course_id: '', external_url: '',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => { loadMaterials(); loadCourses(); }, []);

  useEffect(() => { loadMaterials(); }, [filter]);

  const loadMaterials = async () => {
    try {
      const params: any = { per_page: 50 };
      if (filter.course_id) params.course_id = filter.course_id;
      if (filter.type) params.type = filter.type;
      const res = await materialsAPI.list(params);
      setMaterials(res.data.items || []);
    } catch { toast.error('Failed to load materials'); }
    finally { setLoading(false); }
  };

  const loadCourses = async () => {
    try {
      const res = await coursesAPI.list({ per_page: 100 });
      setCourses(res.data.items || []);
    } catch {}
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !form.external_url) {
      toast.error('Please provide a file or URL');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      if (form.course_id) fd.append('course_id', form.course_id);
      if (form.external_url) fd.append('external_url', form.external_url);
      if (file) fd.append('file', file);

      await materialsAPI.upload(fd);
      toast.success('Material uploaded!');
      setShowUpload(false);
      setForm({ title: '', description: '', course_id: '', external_url: '' });
      setFile(null);
      loadMaterials();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    try {
      await materialsAPI.delete(id);
      toast.success('Deleted');
      loadMaterials();
    } catch { toast.error('Failed to delete'); }
  };

  const handleDownload = async (id: string, title: string) => {
    try {
      const res = await materialsAPI.download(id);
      const blob: Blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header, fall back to title
      const disposition = res.headers['content-disposition'];
      let filename = title.replace(/\s+/g, '_');
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]+)\1/);
        if (match?.[2]) filename = match[2];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download material'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Learning Materials</h1>
          <p className="text-sm text-gray-500 mt-1">Manage PDFs, documents, videos and links</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'instructor') && (
          <Button icon={<Upload className="w-4 h-4" />} onClick={() => setShowUpload(true)}>Upload Material</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filter.course_id} onChange={(e) => setFilter({ ...filter, course_id: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500">
          <option value="">All Types</option>
          <option value="pdf">PDF</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
          <option value="link">Link</option>
        </select>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-primary-500" />}
          title="No materials found"
          description="Upload learning materials to get started."
          action={
            (user?.role === 'admin' || user?.role === 'instructor') ? (
              <Button onClick={() => setShowUpload(true)} icon={<Upload className="w-4 h-4" />}>Upload</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {materials.map((m) => (
            <Card key={m.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  m.material_type === 'pdf' ? 'bg-red-100' :
                  m.material_type === 'video' ? 'bg-blue-100' :
                  m.material_type === 'link' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <FileText className={`w-5 h-5 ${
                    m.material_type === 'pdf' ? 'text-red-500' :
                    m.material_type === 'video' ? 'text-blue-500' :
                    m.material_type === 'link' ? 'text-green-500' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{m.title}</p>
                  <p className="text-xs text-gray-400">{m.material_type} • {new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{m.material_type}</Badge>
                {m.external_url ? (
                  <a href={m.external_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<LinkIcon className="w-4 h-4" />}>Open</Button>
                  </a>
                ) : m.file_path ? (
                  <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}
                    onClick={() => handleDownload(m.id, m.title)}>Download</Button>
                ) : null}
                {(user?.role === 'admin') && (
                  <Button variant="danger" size="sm" icon={<Trash className="w-4 h-4" />} onClick={() => handleDelete(m.id)} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Material" size="md">
        <form onSubmit={handleUpload} className="space-y-4">
          <Input label="Title *" placeholder="e.g. Python Basics PDF" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <TextArea label="Description" placeholder="Brief description..." value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Course (optional)" value={form.course_id}
            onChange={(e) => setForm({ ...form, course_id: e.target.value })}
            options={[{ value: '', label: 'None' }, ...courses.map(c => ({ value: c.id, label: c.title }))]}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Upload File</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.webm,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100"
            />
          </div>

          <div className="text-center text-xs text-gray-400 py-1">— or —</div>

          <Input label="External URL" placeholder="https://..." value={form.external_url}
            onChange={(e) => setForm({ ...form, external_url: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowUpload(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={uploading} className="flex-1" icon={<Upload className="w-4 h-4" />}>Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
