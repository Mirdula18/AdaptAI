import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { usersAPI, authAPI } from '@/lib/api';
import { Card, Button, Loading, DataTable, Badge, Modal, Input, Select } from '@/components/ui';
import { Users, Search, Pencil, Trash, Plus, Key, UserPlus, Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: '', is_active: true });
  const [showCreateInstructor, setShowCreateInstructor] = useState(false);
  const [instructorForm, setInstructorForm] = useState({ username: '', email: '', full_name: '' });
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'instructor') router.push('/dashboard');
  }, [user]);

  useEffect(() => { loadUsers(); }, [search, roleFilter]);

  const loadUsers = async () => {
    try {
      const params: any = { per_page: 100 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const res = await usersAPI.list(params);
      setUsers(res.data.items || []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active });
  };

  const handleSave = async () => {
    try {
      await usersAPI.update(editUser.id, editForm);
      toast.success('User updated');
      setEditUser(null);
      loadUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await usersAPI.delete(id);
      toast.success('User deleted');
      loadUsers();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all platform users</p>
        </div>
        {user?.role === 'admin' && (
          <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => { setShowCreateInstructor(true); setCreatedCredentials(null); setInstructorForm({ username: '', email: '', full_name: '' }); }}>
            Create Instructor
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search users..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">All Roles</option>
          <option value="student">Students</option>
          <option value="instructor">Instructors</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'full_name', title: 'Name' },
          { key: 'username', title: 'Username' },
          { key: 'email', title: 'Email' },
          {
            key: 'role', title: 'Role',
            render: (u: any) => (
              <Badge variant={u.role === 'admin' ? 'danger' : u.role === 'instructor' ? 'primary' : 'gray'}>
                {u.role}
              </Badge>
            ),
          },
          {
            key: 'is_active', title: 'Status',
            render: (u: any) => <Badge variant={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>,
          },
          {
            key: 'actions', title: 'Actions',
            render: (u: any) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" icon={<Pencil className="w-3 h-3" />} onClick={() => handleEdit(u)} />
                {user?.role === 'admin' && (
                  <>
                    <Button variant="ghost" size="sm" icon={<Key className="w-3 h-3 text-amber-500" />} 
                      onClick={() => { setResetPasswordTarget(u); setNewPassword(''); }} title="Reset Password" />
                    <Button variant="ghost" size="sm" icon={<Trash className="w-3 h-3 text-red-500" />} onClick={() => handleDelete(u.id)} />
                  </>
                )}
              </div>
            ),
          },
        ]}
        data={users}
      />

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        <div className="space-y-4">
          <Input label="Full Name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          <Input label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Select label="Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'instructor', label: 'Instructor' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-500 rounded" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditUser(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} className="flex-1">Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Create Instructor Modal */}
      <Modal isOpen={showCreateInstructor} onClose={() => setShowCreateInstructor(false)} title="Create Instructor Account">
        {createdCredentials ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800">Instructor account created!</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono font-semibold">{createdCredentials.username}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.username); toast.success('Copied!'); }}
                    className="text-gray-400 hover:text-primary-500"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Temporary Password</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono font-semibold text-amber-700">{createdCredentials.temp_password}</p>
                  <button onClick={() => { navigator.clipboard.writeText(createdCredentials.temp_password); toast.success('Copied!'); }}
                    className="text-gray-400 hover:text-primary-500"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">Share these credentials securely with the instructor.</p>
            <Button onClick={() => { setShowCreateInstructor(false); loadUsers(); }} className="w-full">Done</Button>
          </div>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setActionLoading(true);
            try {
              const res = await authAPI.createInstructor(instructorForm);
              setCreatedCredentials(res.data);
              toast.success('Instructor created!');
            } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to create instructor'); }
            finally { setActionLoading(false); }
          }} className="space-y-4">
            <Input label="Full Name" required value={instructorForm.full_name}
              onChange={(e) => setInstructorForm({ ...instructorForm, full_name: e.target.value })} />
            <Input label="Username" required value={instructorForm.username}
              onChange={(e) => setInstructorForm({ ...instructorForm, username: e.target.value })} />
            <Input label="Email" type="email" required value={instructorForm.email}
              onChange={(e) => setInstructorForm({ ...instructorForm, email: e.target.value })} />
            <p className="text-xs text-gray-500">A temporary password will be auto-generated and a welcome email sent.</p>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={() => setShowCreateInstructor(false)} className="flex-1">Cancel</Button>
              <Button type="submit" loading={actionLoading} className="flex-1">Create Instructor</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetPasswordTarget} onClose={() => setResetPasswordTarget(null)} title="Reset User Password">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setActionLoading(true);
          try {
            await authAPI.adminResetPassword({ user_id: resetPasswordTarget.id, new_password: newPassword });
            toast.success(`Password reset for ${resetPasswordTarget.full_name}`);
            setResetPasswordTarget(null);
          } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to reset password'); }
          finally { setActionLoading(false); }
        }} className="space-y-4">
          <p className="text-sm text-gray-600">
            Reset password for <span className="font-semibold">{resetPasswordTarget?.full_name}</span> ({resetPasswordTarget?.username})
          </p>
          <Input label="New Password" type="password" required minLength={6} value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setResetPasswordTarget(null)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={actionLoading} className="flex-1">Reset Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
